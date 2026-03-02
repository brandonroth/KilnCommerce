import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createHandler } from "./products";
import type { ProductsRepository } from "./db/products-repo";

const available = {
  slug: "bowl-1",
  name: "Bowl 1",
  price: 25,
  images: [],
  tagline: "Nice bowl",
  tags: [],
  details: [],
  description: "A bowl",
};

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method: "GET" } },
    headers: {},
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

function makeRepo(overrides: Partial<ProductsRepository> = {}): ProductsRepository {
  return {
    getAll: jest.fn().mockResolvedValue({ items: [available] }),
    getBySlug: jest.fn().mockResolvedValue(available),
    getBySlugs: jest.fn(),
    reserve: jest.fn(),
    markSold: jest.fn(),
    release: jest.fn(),
    ...overrides,
  } as unknown as ProductsRepository;
}

describe("products handler", () => {
  describe("GET /products", () => {
    it("calls repo with status=available by default", async () => {
      const repo = makeRepo();
      const handler = createHandler({ productsRepo: repo });
      await handler(makeEvent());
      expect(repo.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: "available" }));
    });

    it("calls repo with status=sold when ?status=sold", async () => {
      const repo = makeRepo();
      const handler = createHandler({ productsRepo: repo });
      await handler(makeEvent({ queryStringParameters: { status: "sold" } }));
      expect(repo.getAll).toHaveBeenCalledWith(expect.objectContaining({ status: "sold" }));
    });

    it("returns items and lastKey from repo", async () => {
      const repo = makeRepo({
        getAll: jest.fn().mockResolvedValue({ items: [available], lastKey: "abc123" }),
      });
      const handler = createHandler({ productsRepo: repo });
      const result = await handler(makeEvent());
      expect(result).toMatchObject({ statusCode: 200 });
      const body = JSON.parse((result as { body: string }).body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].slug).toBe("bowl-1");
      expect(body.lastKey).toBe("abc123");
    });

    it("caps limit at 100", async () => {
      const repo = makeRepo();
      const handler = createHandler({ productsRepo: repo });
      await handler(makeEvent({ queryStringParameters: { limit: "500" } }));
      expect(repo.getAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });

    it("forwards lastKey query param to repo", async () => {
      const repo = makeRepo();
      const handler = createHandler({ productsRepo: repo });
      await handler(makeEvent({ queryStringParameters: { lastKey: "tok123" } }));
      expect(repo.getAll).toHaveBeenCalledWith(expect.objectContaining({ lastKey: "tok123" }));
    });
  });

  describe("GET /products/{slug}", () => {
    it("returns product when found", async () => {
      const repo = makeRepo({ getBySlug: jest.fn().mockResolvedValue(available) });
      const handler = createHandler({ productsRepo: repo });
      const result = await handler(makeEvent({ pathParameters: { slug: "bowl-1" } }));
      expect(result).toMatchObject({ statusCode: 200 });
      expect(JSON.parse((result as { body: string }).body)).toEqual(available);
    });

    it("returns 404 when product does not exist", async () => {
      const repo = makeRepo({ getBySlug: jest.fn().mockResolvedValue(null) });
      const handler = createHandler({ productsRepo: repo });
      const result = await handler(makeEvent({ pathParameters: { slug: "missing" } }));
      expect(result).toMatchObject({ statusCode: 404 });
    });
  });
});
