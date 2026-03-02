import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiProductRepository } from "./api-product-repo";
import { Product } from "./types";

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  slug: "test-bowl",
  name: "Test Bowl",
  price: 120,
  images: ["img.jpg"],
  tagline: "A bowl",
  tags: ["wood"],
  details: {},
  ...overrides,
});

const BASE_URL = "https://api.example.com";

beforeEach(() => {
  vi.stubEnv("SITE_API_URL", BASE_URL);
});

function makeRepo() {
  return new ApiProductRepository();
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

describe("ApiProductRepository.getAll", () => {
  it("returns products on success", async () => {
    const products = [makeProduct()];
    mockFetch(200, { items: products });
    const repo = makeRepo();
    await expect(repo.getAll()).resolves.toEqual(products);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/products`);
  });

  it("throws on non-ok response", async () => {
    mockFetch(500, {});
    const repo = makeRepo();
    await expect(repo.getAll()).rejects.toThrow("Failed to fetch products");
  });
});

describe("ApiProductRepository.getBySlug", () => {
  it("returns product on success", async () => {
    const product = makeProduct();
    mockFetch(200, product);
    const repo = makeRepo();
    await expect(repo.getBySlug("test-bowl")).resolves.toEqual(product);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/products/test-bowl`);
  });

  it("returns null on 404", async () => {
    mockFetch(404, null);
    const repo = makeRepo();
    await expect(repo.getBySlug("missing")).resolves.toBeNull();
  });

  it("throws on other error responses", async () => {
    mockFetch(500, {});
    const repo = makeRepo();
    await expect(repo.getBySlug("test-bowl")).rejects.toThrow(
      "Failed to fetch product"
    );
  });
});

describe("ApiProductRepository.getByTag", () => {
  it("returns only products matching the tag", async () => {
    const products = [
      makeProduct({ slug: "a", tags: ["wood"] }),
      makeProduct({ slug: "b", tags: ["ceramic"] }),
      makeProduct({ slug: "c", tags: ["wood", "large"] }),
    ];
    mockFetch(200, { items: products });
    const repo = makeRepo();
    const result = await repo.getByTag("wood");
    expect(result.map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("returns empty array when no products match", async () => {
    mockFetch(200, { items: [makeProduct({ tags: ["ceramic"] })] });
    const repo = makeRepo();
    await expect(repo.getByTag("wood")).resolves.toEqual([]);
  });
});

describe("ApiProductRepository.getFeatured", () => {
  it("returns only products with a badge", async () => {
    const products = [
      makeProduct({ slug: "a", badge: "fan fav" }),
      makeProduct({ slug: "b" }),
      makeProduct({ slug: "c", badge: "new" }),
    ];
    mockFetch(200, { items: products });
    const repo = makeRepo();
    const result = await repo.getFeatured();
    expect(result.map((p) => p.slug)).toEqual(["a", "c"]);
  });
});

describe("ApiProductRepository.getAllTags", () => {
  it("returns sorted unique tags across all products", async () => {
    const products = [
      makeProduct({ tags: ["wood", "small"] }),
      makeProduct({ tags: ["ceramic", "wood"] }),
    ];
    mockFetch(200, { items: products });
    const repo = makeRepo();
    await expect(repo.getAllTags()).resolves.toEqual([
      "ceramic",
      "small",
      "wood",
    ]);
  });

  it("returns empty array when products have no tags", async () => {
    mockFetch(200, { items: [makeProduct({ tags: [] })] });
    const repo = makeRepo();
    await expect(repo.getAllTags()).resolves.toEqual([]);
  });
});
