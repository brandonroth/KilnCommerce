import { Product } from "./types";
import { ProductRepository } from "./product-repo";

export class ApiProductRepository implements ProductRepository {
  private base = `${process.env.SITE_API_URL}/products`;

  async getAll(): Promise<Product[]> {
    const products: Product[] = [];
    let lastKey: string | undefined;

    // Page through all results (catalog is small; typically one request)
    do {
      const url = lastKey
        ? `${this.base}?lastKey=${encodeURIComponent(lastKey)}`
        : this.base;
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[api] getAll failed", { url, status: res.status });
        throw new Error("Failed to fetch products");
      }
      const data = await res.json() as { items: Product[]; lastKey?: string };
      products.push(...data.items);
      lastKey = data.lastKey;
    } while (lastKey);

    return products;
  }

  async getBySlug(slug: string): Promise<Product | null> {
    const url = `${this.base}/${slug}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[api] getBySlug failed", { url, slug, status: res.status });
      throw new Error("Failed to fetch product");
    }
    return res.json();
  }

  async getByTag(tag: string): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter((p) => p.tags.includes(tag));
  }

  async getFeatured(): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter((p) => p.badge);
  }

  async getAllTags(): Promise<string[]> {
    const all = await this.getAll();
    const tags = new Set<string>();
    all.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }
}
