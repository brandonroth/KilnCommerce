import { Post } from "./types";
import { ApiPostRepository } from "./api-post-repo";

export interface PostRepository {
  getAll(): Promise<Post[]>;
  getBySlug(slug: string): Promise<Post | null>;
  getByTag(tag: string): Promise<Post[]>;
  getRecent(limit?: number): Promise<Post[]>;
}

export const postRepo: PostRepository = new ApiPostRepository();
