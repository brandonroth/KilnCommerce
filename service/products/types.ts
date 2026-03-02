export interface Product {
  slug: string;
  name: string;
  price: number;
  images: string[];
  hero?: string;
  tagline: string;
  tags: string[];
  badge?: string;
  details: Record<string, string>;
  description: string;
  /** Shipping weight in ounces */
  weight: number;
  /** Shipping dimensions in inches */
  length: number;
  width: number;
  height: number;
}
