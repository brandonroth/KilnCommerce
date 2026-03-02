import { Resend } from "resend";
import type { CreateOrderInput } from "../db/orders-repo";
import { sendEmail } from "./send-email";

interface SendCustomerEmailDeps {
  resend: Resend;
  fromEmail: string;
  supportEmail: string;
}

export function createSendCustomerEmail(deps: SendCustomerEmailDeps) {
  return async (order: CreateOrderInput): Promise<void> => {
    await sendEmail(
      { resend: deps.resend, fromEmail: deps.fromEmail },
      {
        to: order.customer.email,
        subject: `Your order is confirmed — $${order.total.toFixed(2)}`,
        replyTo: deps.supportEmail,
        body: [
          `Thank you for your order!`,
          ``,
          `Order ID: ${order.orderId}`,
          `Amount:   $${order.total.toFixed(2)}`,
          ``,
          `Your item will be carefully packaged and shipped to you soon.`,
          ``,
          `Questions? Reply to this email and we'll get back to you.`,
        ].join("\n"),
      }
    );
  };
}
