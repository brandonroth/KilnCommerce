import PostPageClient from "./post-page-client";

// Single shell page served for all post slugs via CloudFront rewrite.
// The client reads the slug from the URL at runtime, so new posts
// in S3 appear automatically without rebuilding.
export function generateStaticParams() {
  return [{ slug: "_shell" }];
}

export default function PostPage() {
  return <PostPageClient />;
}
