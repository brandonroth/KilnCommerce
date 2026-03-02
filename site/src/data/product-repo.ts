import { Product } from "./types";
import { ApiProductRepository } from "./api-product-repo";

export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  getByTag(tag: string): Promise<Product[]>;
  getFeatured(): Promise<Product[]>;
  getAllTags(): Promise<string[]>;
}

export const productRepo: ProductRepository = new ApiProductRepository();
