import { Post } from "./types";
import { PostRepository } from "./post-repo";

export class ApiPostRepository implements PostRepository {
  private base = `${process.env.SITE_API_URL}/posts`;

  async getAll(): Promise<Post[]> {
    const res = await fetch(this.base);
    if (!res.ok) {
      console.error("[api] posts getAll failed", { status: res.status });
      throw new Error("Failed to fetch posts");
    }
    return res.json();
  }

  async getBySlug(slug: string): Promise<Post | null> {
    const url = `${this.base}/${slug}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[api] posts getBySlug failed", { slug, status: res.status });
      throw new Error("Failed to fetch post");
    }
    return res.json();
  }

  async getByTag(tag: string): Promise<Post[]> {
    const all = await this.getAll();
    return all.filter((p) => p.tags.includes(tag));
  }

  async getRecent(limit = 6): Promise<Post[]> {
    const all = await this.getAll();
    return all.slice(0, limit);
  }
}
