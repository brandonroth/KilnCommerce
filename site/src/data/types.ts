export interface Product {
  slug: string;
  name: string;
  price: number;
  images: string[]; // required, first image used as hero if no hero set
  hero?: string; // optional override for hero/thumbnail
  tagline: string;
  tags: string[];
  details: Record<string, string>; // fluid key-value metadata
  description?: string; // longer copy for full page
  badge?: string; // "new" | "fan fav" | "sold out" | etc
  orderId?: string; // present when the product has been sold
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface Post {
  slug: string;
  title: string;
  type: "journal" | "gallery";
  date: string;
  published: string; // ISO date for sorting, e.g. "2026-02-15"
  image?: string;
  images?: string[];
  excerpt?: string;
  tags: string[];
  body?: string; // rendered HTML, only present on single-post fetch
}

/** Get the display image for a product (hero or first image) */
export function getProductImage(product: Product): string {
  return product.hero ?? product.images[0];
}

/** Get all unique tags across products */
export function getAllTags(products: Product[]): string[] {
  const tags = new Set<string>();
  products.forEach((p) => p.tags.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}
