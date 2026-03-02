import { Resend } from "resend";
import type { ShippingInfo } from "../db/orders-repo";
import { sendEmail } from "./send-email";

interface SendShippingEmailDeps {
  resend: Resend;
  fromEmail: string;
  siteUrl: string;
  supportEmail: string;
}

interface ShippingEmailOrder {
  orderId: string;
  customer: { email: string; name: string };
  shipping: ShippingInfo;
}

export function createSendShippingEmail(deps: SendShippingEmailDeps) {
  return async (order: ShippingEmailOrder): Promise<void> => {
    const { carrier, trackingNumber, trackingUrl } = order.shipping;
    const orderPageUrl = `${deps.siteUrl}/order/${order.orderId}`;

    await sendEmail(
      { resend: deps.resend, fromEmail: deps.fromEmail },
      {
        to: order.customer.email,
        subject: `Your order has shipped!`,
        replyTo: deps.supportEmail,
        body: [
          `Great news — your order is on its way!`,
          ``,
          `Carrier:         ${carrier.toUpperCase()}`,
          `Tracking number: ${trackingNumber}`,
          `Track package:   ${trackingUrl}`,
          ``,
          `View your order: ${orderPageUrl}`,
          ``,
          `Thank you for your order!`,
        ].join("\n"),
      }
    );
  };
}
