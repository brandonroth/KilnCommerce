import Stripe from "stripe";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { CheckoutsRepository } from "./db/checkouts-repo";
import { OrdersRepository } from "./db/orders-repo";
import { ProductsRepository } from "./db/products-repo";
import { logger } from "./logger";
import { calculateTax } from "./tax";
import { getParam } from "./ssm";

function newOrderId(): string {
  return `ORD-${crypto.randomUUID()}`;
}

interface WebhookDeps {
  stripe: Stripe;
  productsRepo: ProductsRepository;
  checkoutsRepo: CheckoutsRepository;
  ordersRepo: OrdersRepository;
  webhookSecret: string;
}

export function createHandler({ stripe, productsRepo, checkoutsRepo, ordersRepo, webhookSecret }: WebhookDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const sig = event.headers["stripe-signature"];
    if (!sig) {
      return { statusCode: 400, body: "Missing stripe-signature" };
    }

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body ?? "", sig, webhookSecret);
    } catch (err) {
      logger.error({ event: "webhook_signature_failed", error: String(err) });
      return { statusCode: 400, body: "Invalid signature" };
    }

    logger.info({ event: "webhook_received", type: stripeEvent.type });

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;

      const checkout = await checkoutsRepo.get(sessionId);

      const customer = checkout?.customer ?? {
        name: session.customer_details?.name ?? "Unknown",
        email: session.customer_details?.email ?? session.customer_email ?? "unknown",
      };
      const slugs =
        checkout?.items.map((i) => i.slug) ??
        session.metadata?.slugs?.split(",").filter(Boolean) ??
        [];
      const items = checkout?.items ?? [];
      const subtotal = checkout?.subtotal ?? (session.amount_total ?? 0) / 100;
      const tax = calculateTax(subtotal);
      const total = (session.amount_total ?? 0) / 100;
      const shipping = session.collected_information?.shipping_details ?? null;
      const phone = session.customer_details?.phone ?? null;
      const shippingCost = session.shipping_cost;
      const selectedShipping = shippingCost
        ? {
            amount: shippingCost.amount_total / 100,
            rateId: typeof shippingCost.shipping_rate === "string"
              ? shippingCost.shipping_rate
              : (shippingCost.shipping_rate as { id?: string } | null)?.id,
          }
        : undefined;

      const id = newOrderId();
      await ordersRepo.create({
        orderId: id,
        customer: { ...customer, phone, shipping },
        items,
        subtotal,
        tax,
        total,
        selectedShipping,
      });
      logger.info({ event: "order_created", orderId: id, sessionId });

      try {
        await productsRepo.markSold(slugs, id);
        logger.info({ event: "products_marked_sold", orderId: id, slugs });
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
          // Item already assigned to this order from a prior webhook delivery — safe to continue.
          logger.warn({ event: "mark_sold_conflict", orderId: id, slugs });
        } else {
          throw err;
        }
      }

      await checkoutsRepo.delete(sessionId);
    }

    if (stripeEvent.type === "checkout.session.expired") {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;

      const checkout = await checkoutsRepo.get(sessionId);

      const slugs =
        checkout?.items.map((i) => i.slug) ??
        session.metadata?.slugs?.split(",").filter(Boolean) ??
        [];

      logger.info({ event: "checkout_expired", sessionId, slugs });

      try {
        await productsRepo.release(slugs, sessionId);
        logger.info({ event: "products_released", sessionId, slugs });
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
          // Item already released or reserved by a newer session — safe to continue.
          logger.warn({ event: "release_conflict", sessionId, slugs });
        } else {
          throw err;
        }
      }

      await checkoutsRepo.delete(sessionId);
    }

    return { statusCode: 200, body: "ok" };
  };
}

let _handler: ReturnType<typeof createHandler> | undefined;

async function init(): Promise<ReturnType<typeof createHandler>> {
  if (_handler) return _handler;
  const stripeKey = await getParam("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_PATH");
  const webhookSecret = await getParam("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET_PATH");
  _handler = createHandler({
    stripe: new Stripe(stripeKey),
    productsRepo: new ProductsRepository(ddb, process.env.PRODUCTS_TABLE!),
    checkoutsRepo: new CheckoutsRepository(ddb, process.env.CHECKOUTS_TABLE!),
    ordersRepo: new OrdersRepository(ddb, process.env.ORDERS_TABLE!),
    webhookSecret,
  });
  return _handler;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> =>
  (await init())(event);
