import type { APIGatewayProxyEventV2 } from "aws-lambda";
import Stripe from "stripe";
import { createHandler } from "./checkout";
import type { ProductsRepository } from "./db/products-repo";
import type { CheckoutsRepository } from "./db/checkouts-repo";
import type { SettingsRepository } from "./db/settings-repo";

function makeEvent(body: unknown, method = "POST"): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method } },
    headers: {},
    body: body !== null ? JSON.stringify(body) : null,
    pathParameters: {},
  } as unknown as APIGatewayProxyEventV2;
}

const product = {
  slug: "bowl-1",
  name: "Bowl 1",
  price: 25,
  images: [],
  tagline: "Nice bowl",
  tags: [],
  details: [],
  description: "A bowl",
};

const validBody = {
  slugs: ["bowl-1"],
};

function makeProductsRepo(overrides: Partial<ProductsRepository> = {}): ProductsRepository {
  return {
    getAll: jest.fn(),
    getBySlug: jest.fn(),
    getBySlugs: jest.fn().mockResolvedValue([product]),
    reserve: jest.fn().mockResolvedValue(undefined),
    markSold: jest.fn(),
    release: jest.fn(),
    ...overrides,
  } as unknown as ProductsRepository;
}

function makeCheckoutsRepo(overrides: Partial<CheckoutsRepository> = {}): CheckoutsRepository {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as CheckoutsRepository;
}

function makeStripe(sessionOverrides: Partial<Stripe.Checkout.Session> = {}): Stripe {
  return {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: "sess_123",
          client_secret: "cs_test_secret",
          ...sessionOverrides,
        }),
      },
    },
  } as unknown as Stripe;
}

function makeSettingsRepo(overrides: Partial<SettingsRepository> = {}): SettingsRepository {
  return {
    get: jest.fn().mockResolvedValue(undefined), // no override — use Utah defaults
    put: jest.fn().mockResolvedValue(undefined),
    getAll: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as SettingsRepository;
}

function makeDeps(overrides: {
  stripe?: Stripe;
  productsRepo?: ProductsRepository;
  checkoutsRepo?: CheckoutsRepository;
  settingsRepo?: SettingsRepository;
  siteUrl?: string;
} = {}) {
  return {
    stripe: makeStripe(),
    productsRepo: makeProductsRepo(),
    checkoutsRepo: makeCheckoutsRepo(),
    settingsRepo: makeSettingsRepo(),
    siteUrl: "https://example.com",
    ...overrides,
  };
}

describe("checkout handler", () => {
  it("returns 200 with clientSecret and sessionId on success", async () => {
    const deps = makeDeps();
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((result as { body: string }).body)).toEqual({
      clientSecret: "cs_test_secret",
      sessionId: "sess_123",
    });
  });

  it("returns 200 for OPTIONS preflight", async () => {
    const result = await createHandler(makeDeps())(makeEvent(null, "OPTIONS"));
    expect(result).toMatchObject({ statusCode: 200 });
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = await createHandler(makeDeps())({
      ...makeEvent(null),
      body: "not-json",
    } as unknown as APIGatewayProxyEventV2);
    expect(result).toMatchObject({ statusCode: 400 });
    expect(JSON.parse((result as { body: string }).body)).toMatchObject({ error: "Invalid JSON" });
  });

  it("returns 400 when slugs are missing", async () => {
    const result = await createHandler(makeDeps())(makeEvent({}));
    expect(result).toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when products are not found", async () => {
    const deps = makeDeps({ productsRepo: makeProductsRepo({ getBySlugs: jest.fn().mockResolvedValue([]) }) });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 404 });
    expect(JSON.parse((result as { body: string }).body)).toMatchObject({ missing: ["bowl-1"] });
  });

  it("returns 409 when product is already sold", async () => {
    const deps = makeDeps({
      productsRepo: makeProductsRepo({
        getBySlugs: jest.fn().mockResolvedValue([{ ...product, orderId: "ORD-1" }]),
      }),
    });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 409 });
    expect(JSON.parse((result as { body: string }).body)).toMatchObject({ soldOut: ["bowl-1"] });
  });

  it("returns 409 when product is already reserved", async () => {
    const deps = makeDeps({
      productsRepo: makeProductsRepo({
        getBySlugs: jest.fn().mockResolvedValue([{ ...product, pendingSessionId: "sess_other" }]),
      }),
    });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 409 });
  });

  it("returns 409 on TransactionCanceledException race condition", async () => {
    const err = Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
    const deps = makeDeps({
      productsRepo: makeProductsRepo({ reserve: jest.fn().mockRejectedValue(err) }),
    });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 409 });
    expect(JSON.parse((result as { body: string }).body).error).toMatch(/just sold or reserved/);
  });

  it("returns 500 on unexpected error", async () => {
    const deps = makeDeps({
      productsRepo: makeProductsRepo({ reserve: jest.fn().mockRejectedValue(new Error("boom")) }),
    });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 500 });
  });

  it("creates stripe session with dynamic shipping enabled", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    expect(deps.stripe.checkout.sessions.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        ui_mode: "embedded",
        return_url: "https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        metadata: expect.objectContaining({ slugs: "bowl-1" }),
        shipping_address_collection: { allowed_countries: ["US"] },
        permissions: { update_shipping_details: "server_only" },
      })
    );
  });

  it("reserves products with the stripe session id", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    expect(deps.productsRepo.reserve as jest.Mock).toHaveBeenCalledWith(["bowl-1"], "sess_123");
  });

  it("stores checkout record after session created", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    expect(deps.checkoutsRepo.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess_123",
        items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
        subtotal: 25,
        tax: 1.86,
        total: 26.86,
      })
    );
    // customer is not stored at checkout creation — Stripe collects it, webhook reads it from customer_details
    expect(deps.checkoutsRepo.create as jest.Mock).toHaveBeenCalledWith(
      expect.not.objectContaining({ customer: expect.anything() })
    );
  });

  it("includes tax as a line item in the stripe session", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    const call = (deps.stripe.checkout.sessions.create as jest.Mock).mock.calls[0][0];
    const taxLine = call.line_items.find((li: { price_data: { product_data: { name: string } } }) =>
      li.price_data.product_data.name.includes("Sales Tax")
    );
    expect(taxLine).toBeDefined();
    expect(taxLine.price_data.unit_amount).toBe(186); // $1.86 in cents
  });
});
