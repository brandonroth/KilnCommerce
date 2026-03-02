import Stripe from "stripe";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { ProductsRepository } from "./db/products-repo";
import { CheckoutsRepository } from "./db/checkouts-repo";
import { SettingsRepository } from "./db/settings-repo";
import { logger } from "./logger";
import { calculateTax, toCents } from "./tax";
import { CURRENCY } from "./config";
import { corsHeaders } from "./cors";
import { getParam } from "./ssm";

interface CheckoutBody {
  slugs?: string[];
}

interface CheckoutDeps {
  stripe: Stripe;
  productsRepo: ProductsRepository;
  checkoutsRepo: CheckoutsRepository;
  settingsRepo: SettingsRepository;
  siteUrl: string;
  /**
   * Fallback flat tax rate from the TAX_RATE env var (e.g. 8.25 for 8.25%).
   * The DynamoDB `tax.rate` setting takes precedence over this.
   * Omit both to use the default Utah component rates.
   */
  taxRateEnvFallback?: number;
}

export function createHandler({ stripe, productsRepo, checkoutsRepo, settingsRepo, siteUrl, taxRateEnvFallback }: CheckoutDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const method = event.requestContext.http.method;

    if (method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(event), body: "" };
    }

    if (method === "DELETE") {
      const sessionId = event.pathParameters?.sessionId;
      if (!sessionId?.startsWith("cs_")) {
        return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Invalid session ID" }) };
      }
      try {
        await stripe.checkout.sessions.expire(sessionId);
        logger.info({ event: "checkout_cancelled", sessionId });
      } catch (err: unknown) {
        // Already expired or completed — webhook already handled it, not an error
        const msg = String((err as { message?: string }).message ?? "");
        if (!msg.includes("expired") && !msg.includes("complete")) {
          logger.error({ event: "cancel_error", sessionId, error: msg });
          return { statusCode: 502, headers: corsHeaders(event), body: JSON.stringify({ error: "Failed to cancel session" }) };
        }
        logger.info({ event: "checkout_cancel_noop", sessionId });
      }
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
    }

    let body: CheckoutBody;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { slugs } = body;

    if (!slugs?.length) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    logger.info({ event: "checkout_start", slugs });

    const products = await productsRepo.getBySlugs(slugs);

    if (products.length !== slugs.length) {
      const foundSlugs = new Set(products.map((p) => p.slug));
      const missing = slugs.filter((s) => !foundSlugs.has(s));
      logger.warn({ event: "checkout_products_missing", slugs, missing });
      return {
        statusCode: 404,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "Products not found", missing }),
      };
    }

    const unavailable = products.filter((p) => p.orderId || p.pendingSessionId);

    if (unavailable.length) {
      logger.warn({ event: "checkout_unavailable_rejected", unavailable: unavailable.map((p) => p.slug) });
      return {
        statusCode: 409,
        headers: corsHeaders(event),
        body: JSON.stringify({
          error: "One or more items are no longer available",
          soldOut: unavailable.map((p) => p.slug),
        }),
      };
    }

    const subtotal = products.reduce((s, p) => s + p.price, 0);
    // Fall back gracefully if the settings table isn't available
    const taxRateSetting = await settingsRepo.get("tax.rate").catch(() => undefined);
    const taxRatePercent = taxRateSetting ? parseFloat(taxRateSetting) : taxRateEnvFallback;
    const tax = calculateTax(subtotal, taxRatePercent);
    const total = subtotal + tax.total;
    const items = products.map((p) => ({ slug: p.slug, name: p.name, price: p.price }));
    const now = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + 31 * 60; // 31 min: Stripe minimum is 30, +1 for cold-start headroom

    logger.info({ event: "checkout_pricing", subtotal, tax, total, itemCount: items.length });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          ...products.map((p) => ({
            price_data: {
              currency: CURRENCY,
              unit_amount: toCents(p.price),
              product_data: { name: p.name },
            },
            quantity: 1,
          })),
          {
            price_data: {
              currency: CURRENCY,
              unit_amount: toCents(tax.total),
              product_data: { name: tax.label },
            },
            quantity: 1,
          },
        ],
        // Stripe collects the address and calls onShippingDetailsChange; our Lambda
        // fetches Shippo rates and updates the session with real shipping_options.
        shipping_address_collection: { allowed_countries: ["US"] },
        permissions: { update_shipping_details: "server_only" },
        shipping_options: [],
        phone_number_collection: { enabled: true },
        allow_promotion_codes: true,
        expires_at: expiresAt,
        metadata: {
          slugs: slugs.join(","),
        },
        ui_mode: "embedded",
        return_url: `${siteUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });

      logger.info({ event: "stripe_session_created", sessionId: session.id });

      await productsRepo.reserve(slugs, session.id);
      await checkoutsRepo.create({ sessionId: session.id, createdAt: now, expiresAt, items, subtotal, tax: tax.total, total });

      logger.info({ event: "checkout_recorded", sessionId: session.id });

      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }) };
    } catch (err: unknown) {
      const errName = (err as { name?: string }).name;
      if (errName === "TransactionCanceledException") {
        logger.warn({ event: "checkout_transaction_conflict", slugs });
        return {
          statusCode: 409,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: "One or more items were just sold or reserved — please refresh your cart" }),
        };
      }
      logger.error({ event: "checkout_error", error: String(err) });
      return {
        statusCode: 500,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "Checkout failed" }),
      };
    }
  };
}

let _handler: ReturnType<typeof createHandler> | undefined;

async function init(): Promise<ReturnType<typeof createHandler>> {
  if (_handler) return _handler;
  const stripeKey = await getParam("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_PATH");
  const taxRateEnv = process.env.TAX_RATE ? parseFloat(process.env.TAX_RATE) : undefined;
  _handler = createHandler({
    stripe: new Stripe(stripeKey),
    productsRepo: new ProductsRepository(ddb, process.env.PRODUCTS_TABLE!),
    checkoutsRepo: new CheckoutsRepository(ddb, process.env.CHECKOUTS_TABLE!),
    settingsRepo: new SettingsRepository(ddb, process.env.SETTINGS_TABLE!),
    siteUrl: process.env.SITE_URL!,
    taxRateEnvFallback: taxRateEnv,
  });
  return _handler;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> =>
  (await init())(event);
