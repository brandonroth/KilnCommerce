import { describe, it, expect } from "vitest";
import { getProductImage, getAllTags, Product } from "./types";

const base: Product = {
  slug: "test",
  name: "Test Bowl",
  price: 100,
  images: ["first.jpg", "second.jpg"],
  tagline: "A test bowl",
  tags: [],
  details: {},
};

describe("getProductImage", () => {
  it("returns hero when set", () => {
    expect(getProductImage({ ...base, hero: "hero.jpg" })).toBe("hero.jpg");
  });

  it("falls back to first image when no hero", () => {
    expect(getProductImage(base)).toBe("first.jpg");
  });
});

describe("getAllTags", () => {
  it("returns unique sorted tags across products", () => {
    const products = [
      { ...base, tags: ["wood", "small"] },
      { ...base, tags: ["ceramic", "wood"] },
    ];
    expect(getAllTags(products)).toEqual(["ceramic", "small", "wood"]);
  });

  it("returns empty array for no products", () => {
    expect(getAllTags([])).toEqual([]);
  });

  it("returns empty array for products with no tags", () => {
    expect(getAllTags([base, base])).toEqual([]);
  });
});
