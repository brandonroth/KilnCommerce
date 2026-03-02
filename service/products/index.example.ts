import type { Product } from "./types";
export type { Product };

/**
 * Product catalog — copy this file to index.ts and replace with your own products.
 *
 * Each product is seeded to DynamoDB via `npm run seed` from the service directory.
 * Images should be placed in site/public/images/ and will be uploaded to S3 on seed.
 *
 * Fields:
 *   slug        — unique URL-safe identifier (used as the DynamoDB primary key)
 *   name        — display name (lowercase is fine, styled in CSS)
 *   price       — price in USD cents-free dollars (e.g. 48 = $48.00)
 *   images      — array of image paths served from S3 (e.g. "/images/my-bowl.webp")
 *   hero        — optional: alternate hero image path shown on detail page
 *   tagline     — short descriptor shown on the card
 *   tags        — filter categories (e.g. "bowls", "mugs", "functional")
 *   badge       — optional: small label badge (e.g. "new", "fan fav", "sold out")
 *   details     — key/value pairs shown in the product detail panel
 *   description — longer copy shown on the product page
 *   weight      — shipping weight in ounces
 *   length/width/height — shipping box dimensions in inches
 */
export const products: Product[] = [
  {
    slug: "example-bowl",
    name: "example bowl",
    price: 48,
    images: ["/images/post-glaze.jpg"],
    tagline: "your tagline here · short descriptor",
    tags: ["bowls", "functional"],
    badge: "new",
    details: {
      diameter: "~8 inches",
      glaze: "your glaze description",
      firing: "electric, cone 6",
      "food safe": "yes",
      "good for": "pasta, soup, cereal",
    },
    description:
      "Write a description of your product here. Tell the story of the piece — the glaze, the form, what makes it special. Keep it conversational.",
    weight: 36,
    length: 9,
    width: 9,
    height: 4,
  },
  {
    slug: "example-mug",
    name: "example mug",
    price: 42,
    images: ["/images/post-glaze.jpg"],
    tagline: "another tagline · cozy vibes",
    tags: ["mugs", "functional"],
    details: {
      size: "12oz",
      glaze: "your glaze description",
      firing: "gas reduction, cone 10",
      "food safe": "yes",
      handle: "comfortable grip",
      "good for": "coffee, tea",
    },
    description:
      "Describe your mug here. Mention the glaze, the size, the handle — whatever makes someone want to drink from it every morning.",
    weight: 22,
    length: 5,
    width: 4,
    height: 5,
  },
];
