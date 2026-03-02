import OrderPageClient from "./order-page-client";

// Shell page served for all order IDs via CloudFront rewrite.
// The client reads the orderId from the URL at runtime.
export function generateStaticParams() {
  return [{ orderId: "_shell" }];
}

export default function OrderPage() {
  return <OrderPageClient />;
}
