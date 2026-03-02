import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { OrdersRepository } from "./db/orders-repo";
import { logger } from "./logger";

const JSON_HEADERS = { "Content-Type": "application/json" };

interface OrdersDeps {
  ordersRepo: OrdersRepository;
}

/**
 * Public order lookup — returns sanitized order data (items + shipping only, no PII or financial data).
 * orderId is an unguessable UUID so no auth is required.
 */
export function createHandler({ ordersRepo }: OrdersDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const orderId = event.pathParameters?.orderId;
    if (!orderId) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Missing orderId" }) };
    }

    logger.info({ event: "order_lookup", orderId });

    try {
      const order = await ordersRepo.getById(orderId);

      if (!order) {
        return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Order not found" }) };
      }

      const items = order.items as { name: string }[];
      const shipping = order.shipping as { carrier: string; trackingNumber: string; trackingUrl: string; shippedAt: string } | undefined;

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          orderId: order.orderId,
          createdAt: order.createdAt,
          items: items.map(({ name }) => ({ name })),
          shipping: shipping ?? null,
        }),
      };
    } catch (err) {
      logger.error({ event: "order_lookup_error", orderId, error: String(err) });
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Failed to fetch order" }) };
    }
  };
}

export const handler = createHandler({
  ordersRepo: new OrdersRepository(ddb, process.env.ORDERS_TABLE!),
});
