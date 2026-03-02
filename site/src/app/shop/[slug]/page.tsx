import ProductPageClient from "./product-page-client";

// Single shell page served for all product slugs via CloudFront rewrite.
// New products added via the admin console appear automatically without rebuilding.
export function generateStaticParams() {
  return [{ slug: "_shell" }];
}

export default function ProductPage() {
  return <ProductPageClient />;
}
