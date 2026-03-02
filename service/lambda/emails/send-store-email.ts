import { Resend } from "resend";
import type { CreateOrderInput } from "../db/orders-repo";
import { sendEmail } from "./send-email";

interface SendStoreEmailDeps {
  resend: Resend;
  fromEmail: string;
  ownerEmail: string;
}

export function createSendStoreEmail(deps: SendStoreEmailDeps) {
  return async (order: CreateOrderInput): Promise<void> => {
    await sendEmail(
      { resend: deps.resend, fromEmail: deps.fromEmail },
      {
        to: deps.ownerEmail,
        subject: `Payment received — ${order.customer.name} — $${order.total.toFixed(2)}`,
        body: [
          `Payment confirmed via Stripe.`,
          ``,
          `Order ID: ${order.orderId}`,
          `Customer: ${order.customer.name} <${order.customer.email}>`,
          `Amount:   $${order.total.toFixed(2)}`,
        ].join("\n"),
      }
    );
  };
}
