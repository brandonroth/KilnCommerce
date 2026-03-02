import { Resend } from "resend";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import type { CreateOrderInput, ShippingInfo } from "./db/orders-repo";
import { createSendStoreEmail } from "./emails/send-store-email";
import { createSendCustomerEmail } from "./emails/send-customer-email";
import { createSendShippingEmail } from "./emails/send-shipping-email";
import { logger } from "./logger";

interface EmailDeps {
  resend: Resend;
  fromEmail: string;
  ownerEmail: string;
  siteUrl: string;
  supportEmail: string;
}

export function createHandler({ resend, fromEmail, ownerEmail, siteUrl, supportEmail }: EmailDeps) {
  const sendStoreEmail = createSendStoreEmail({ resend, fromEmail, ownerEmail });
  const sendCustomerEmail = createSendCustomerEmail({ resend, fromEmail, supportEmail });
  const sendShippingEmail = createSendShippingEmail({ resend, fromEmail, siteUrl, supportEmail });

  return async (event: DynamoDBStreamEvent) => {
    for (const record of event.Records) {
      if (!record.dynamodb?.NewImage) continue;

      const newOrder = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);

      if (record.eventName === "INSERT") {
        try {
          await sendStoreEmail(newOrder as CreateOrderInput);
        } catch (err) {
          logger.error({ event: "store_email_failed", orderId: newOrder.orderId, error: String(err) });
        }

        try {
          await sendCustomerEmail(newOrder as CreateOrderInput);
        } catch (err) {
          logger.error({ event: "customer_email_failed", orderId: newOrder.orderId, error: String(err) });
        }
      } else if (record.eventName === "MODIFY") {
        // Send shipping notification only when shipping is newly added (not on subsequent updates)
        const oldOrder = record.dynamodb.OldImage
          ? unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>)
          : null;

        // Resend whenever shipping changes, not just on first-time add.
        // This covers corrections (wrong tracking number, carrier change, etc.).
        const oldShippingJson = JSON.stringify(oldOrder?.shipping ?? null);
        const newShippingJson = JSON.stringify(newOrder.shipping ?? null);
        if (newOrder.shipping && oldShippingJson !== newShippingJson) {
          try {
            await sendShippingEmail({
              orderId: newOrder.orderId as string,
              customer: newOrder.customer as { email: string; name: string },
              shipping: newOrder.shipping as ShippingInfo,
            });
          } catch (err) {
            logger.error({ event: "shipping_email_failed", orderId: newOrder.orderId, error: String(err) });
          }
        }
      }
    }
  };
}

export const handler = createHandler({
  resend: new Resend(process.env.RESEND_API_KEY!),
  fromEmail: process.env.FROM_EMAIL!,
  ownerEmail: process.env.OWNER_EMAIL!,
  siteUrl: process.env.SITE_URL!,
  supportEmail: process.env.SUPPORT_EMAIL!,
});
