import Stripe from "stripe";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { ProductsRepository } from "./db/products-repo";
import { logger } from "./logger";
import { toCents } from "./tax";
import { CURRENCY } from "./config";
import { corsHeaders } from "./cors";
import { getParam } from "./ssm";

/** Shape Stripe sends to the onShippingDetailsChange client callback */
interface ShippingDetails {
  name: string;
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface ShippingRatesBody {
  checkoutSessionId?: string;
  shippingDetails?: ShippingDetails;
}

interface ShippingRatesDeps {
  stripe: Stripe;
  productsRepo: ProductsRepository;
}

export function createHandler({ stripe, productsRepo }: ShippingRatesDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(event), body: "" };
    }

    let body: ShippingRatesBody;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { checkoutSessionId, shippingDetails } = body;

    if (!checkoutSessionId || !shippingDetails) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "checkoutSessionId and shippingDetails are required" }),
      };
    }

    logger.info({ event: "shipping_rates_request", checkoutSessionId });

    // Retrieve the session to get slugs from metadata
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    } catch (err) {
      logger.error({ event: "session_retrieve_failed", checkoutSessionId, error: String(err) });
      return { statusCode: 404, headers: corsHeaders(event), body: JSON.stringify({ error: "Session not found" }) };
    }

    const slugs = session.metadata?.slugs?.split(",").filter(Boolean) ?? [];
    if (!slugs.length) {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "No items in session" }) };
    }

    const products = await productsRepo.getBySlugs(slugs);

    // TODO: replace with live Shippo rates once account is configured.
    // For now, calculate a flat rate: $10 + 5% of subtotal, clamped to [$3, $15].
    const subtotal = products.reduce((sum, p) => sum + p.price, 0);
    const rateAmount = Math.min(15, Math.max(3, 10 + subtotal * 0.05));
    const shippoRates = [{ displayName: "Standard Shipping", amount: rateAmount, estimatedDays: 5 }];

    logger.info({ event: "shipping_rate_calculated", subtotal, rateAmount });

    // Update the Stripe session with the validated shipping address and calculated rates.
    // With update_shipping_details: "server_only", both must be set together or Stripe
    // will reject payment with "Shipping details missing".
    try {
      await stripe.checkout.sessions.update(checkoutSessionId, {
        collected_information: {
          shipping_details: {
            name: shippingDetails.name,
            address: {
              line1: shippingDetails.address.line1,
              line2: shippingDetails.address.line2 ?? undefined,
              city: shippingDetails.address.city,
              state: shippingDetails.address.state,
              postal_code: shippingDetails.address.postal_code,
              country: shippingDetails.address.country,
            },
          },
        },
        shipping_options: shippoRates.map((r) => ({
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: toCents(r.amount), currency: CURRENCY },
            display_name: r.displayName,
            delivery_estimate: {
              minimum: { unit: "business_day", value: r.estimatedDays },
              maximum: { unit: "business_day", value: r.estimatedDays + 2 },
            },
          },
        })),
      });
      logger.info({ event: "stripe_session_updated", checkoutSessionId });
    } catch (err) {
      logger.error({ event: "stripe_update_failed", checkoutSessionId, error: String(err) });
      return { statusCode: 502, headers: corsHeaders(event), body: JSON.stringify({ error: "Failed to update shipping options" }) };
    }

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
  };
}

let _handler: ReturnType<typeof createHandler> | undefined;

async function init(): Promise<ReturnType<typeof createHandler>> {
  if (_handler) return _handler;
  const stripeKey = await getParam("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_PATH");
  _handler = createHandler({
    stripe: new Stripe(stripeKey),
    productsRepo: new ProductsRepository(ddb, process.env.PRODUCTS_TABLE!),
  });
  return _handler;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> =>
  (await init())(event);
