import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { OrdersRepository, type ShippingInfo } from "./db/orders-repo";
import { logger } from "./logger";

function trackingUrl(carrier: string, trackingNumber: string): string {
  return `https://tracking.shippo.com/track/${carrier}/${trackingNumber}`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

interface ShippingDeps {
  ordersRepo: OrdersRepository;
}

/**
 * Admin-only handler for PATCH /admin/orders/{orderId}/shipping.
 * Records shipping info on the order and triggers the email lambda via DynamoDB stream.
 * Auth is enforced at the API Gateway layer via Cognito JWT authorizer.
 */
export function createHandler({ ordersRepo }: ShippingDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const orderId = event.pathParameters?.orderId;
    if (!orderId) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Missing orderId" }) };
    }

    let body: { carrier?: string; service?: string; trackingNumber?: string; cost?: number };
    try {
      body = JSON.parse(event.body ?? "{}") as { carrier?: string; service?: string; trackingNumber?: string; cost?: number };
    } catch {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { carrier, service, trackingNumber, cost } = body;
    if (!carrier || !service || !trackingNumber || cost === undefined) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "carrier, service, trackingNumber, and cost are required" }) };
    }
    if (typeof cost !== "number" || cost < 0) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "cost must be a non-negative number" }) };
    }

    const shipping: ShippingInfo = {
      carrier,
      service,
      trackingNumber,
      trackingUrl: trackingUrl(carrier, trackingNumber),
      cost,
      shippedAt: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = ((event.requestContext as any).authorizer?.jwt?.claims ?? {}) as Record<string, string>;
    const caller = claims.email ?? claims.sub ?? "unknown";
    logger.info({ event: "mark_shipped", orderId, carrier, caller });

    try {
      await ordersRepo.addShipping(orderId, shipping);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, shipping }) };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Order not found" }) };
      }
      logger.error({ event: "mark_shipped_error", orderId, error: String(err) });
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Failed to update order" }) };
    }
  };
}

export const handler = createHandler({
  ordersRepo: new OrdersRepository(ddb, process.env.ORDERS_TABLE!),
});
