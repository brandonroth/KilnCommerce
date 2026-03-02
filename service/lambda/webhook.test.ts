import type { APIGatewayProxyEventV2 } from "aws-lambda";
import Stripe from "stripe";
import { createHandler } from "./webhook";
import type { ProductsRepository } from "./db/products-repo";
import type { CheckoutsRepository } from "./db/checkouts-repo";
import type { OrdersRepository } from "./db/orders-repo";

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    headers: { "stripe-signature": "test-sig" },
    body: "{}",
    requestContext: { http: { method: "POST" } },
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

const checkoutRecord = {
  sessionId: "sess_abc",
  createdAt: "2024-01-01T00:00:00.000Z",
  expiresAt: 1700000000,
  customer: { name: "Alice", email: "alice@example.com" },
  items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
  subtotal: 25,
  tax: 1.86,
  total: 26.86,
};

function makeCompletedSession(overrides: object = {}): Stripe.Checkout.Session {
  return {
    id: "sess_abc",
    amount_total: 2686,
    customer_email: "alice@example.com",
    customer_details: { name: "Alice", email: "alice@example.com", phone: "+15555555555" },
    collected_information: { shipping_details: null },
    metadata: {
      customer_name: "Alice",
      customer_email: "alice@example.com",
      slugs: "bowl-1",
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function makeProductsRepo(overrides: Partial<ProductsRepository> = {}): ProductsRepository {
  return {
    getAll: jest.fn(),
    getBySlug: jest.fn(),
    getBySlugs: jest.fn(),
    reserve: jest.fn(),
    markSold: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ProductsRepository;
}

function makeCheckoutsRepo(overrides: Partial<CheckoutsRepository> = {}): CheckoutsRepository {
  return {
    create: jest.fn(),
    get: jest.fn().mockResolvedValue(checkoutRecord),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CheckoutsRepository;
}

function makeOrdersRepo(overrides: Partial<OrdersRepository> = {}): OrdersRepository {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as OrdersRepository;
}

type Deps = ReturnType<typeof makeDeps>;

function makeDeps(overrides: {
  constructEvent?: jest.Mock;
  productsRepo?: ProductsRepository;
  checkoutsRepo?: CheckoutsRepository;
  ordersRepo?: OrdersRepository;
} = {}) {
  const constructEvent = overrides.constructEvent ?? jest.fn();
  return {
    stripe: { webhooks: { constructEvent } } as unknown as Stripe,
    productsRepo: overrides.productsRepo ?? makeProductsRepo(),
    checkoutsRepo: overrides.checkoutsRepo ?? makeCheckoutsRepo(),
    ordersRepo: overrides.ordersRepo ?? makeOrdersRepo(),
    webhookSecret: "whsec_test",
  };
}

function setupCompleted(deps: Deps, sessionOverrides: object = {}) {
  const session = makeCompletedSession(sessionOverrides);
  (deps.stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
    type: "checkout.session.completed",
    data: { object: session },
  });
  return session;
}

function setupExpired(deps: Deps, sessionOverrides: object = {}) {
  const session = { id: "sess_abc", metadata: { slugs: "bowl-1" }, ...sessionOverrides } as unknown as Stripe.Checkout.Session;
  (deps.stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
    type: "checkout.session.expired",
    data: { object: session },
  });
  return session;
}

describe("webhook handler", () => {
  describe("signature validation", () => {
    it("returns 400 when stripe-signature header is missing", async () => {
      const deps = makeDeps();
      const result = await createHandler(deps)(makeEvent({ headers: {} }));
      expect(result).toMatchObject({ statusCode: 400, body: "Missing stripe-signature" });
    });

    it("returns 400 when signature verification fails", async () => {
      const deps = makeDeps({
        constructEvent: jest.fn().mockImplementation(() => {
          throw new Error("Invalid signature");
        }),
      });
      const result = await createHandler(deps)(makeEvent());
      expect(result).toMatchObject({ statusCode: 400, body: "Invalid signature" });
    });
  });

  describe("checkout.session.completed", () => {
    it("creates order with customer info and items from checkout record", async () => {
      const deps = makeDeps();
      setupCompleted(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.ordersRepo.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ name: "Alice", email: "alice@example.com" }),
          items: checkoutRecord.items,
          subtotal: 25,
          tax: expect.objectContaining({ total: 1.86 }),
          total: 26.86,
        })
      );
    });

    it("marks products as sold with a generated order id", async () => {
      const deps = makeDeps();
      setupCompleted(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.productsRepo.markSold as jest.Mock).toHaveBeenCalledWith(
        ["bowl-1"],
        expect.stringMatching(/^ORD-/)
      );
    });

    it("deletes checkout record", async () => {
      const deps = makeDeps();
      setupCompleted(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.checkoutsRepo.delete as jest.Mock).toHaveBeenCalledWith("sess_abc");
    });

    it("falls back to session customer_details when no checkout record exists", async () => {
      const deps = makeDeps({
        checkoutsRepo: makeCheckoutsRepo({ get: jest.fn().mockResolvedValue(null) }),
      });
      setupCompleted(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.productsRepo.markSold as jest.Mock).toHaveBeenCalledWith(
        ["bowl-1"],
        expect.stringMatching(/^ORD-/)
      );
      expect(deps.ordersRepo.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ name: "Alice", email: "alice@example.com" }),
        })
      );
    });

    it("falls back to session customer_details when checkout record has no customer", async () => {
      const recordWithoutCustomer = { ...checkoutRecord, customer: undefined };
      const deps = makeDeps({
        checkoutsRepo: makeCheckoutsRepo({ get: jest.fn().mockResolvedValue(recordWithoutCustomer) }),
      });
      setupCompleted(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.ordersRepo.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ name: "Alice", email: "alice@example.com" }),
        })
      );
    });

    it("returns 200", async () => {
      const deps = makeDeps();
      setupCompleted(deps);
      const result = await createHandler(deps)(makeEvent());
      expect(result).toMatchObject({ statusCode: 200, body: "ok" });
    });
  });

  describe("checkout.session.expired", () => {
    it("releases products", async () => {
      const deps = makeDeps();
      setupExpired(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.productsRepo.release as jest.Mock).toHaveBeenCalledWith(["bowl-1"], "sess_abc");
    });

    it("deletes checkout record", async () => {
      const deps = makeDeps();
      setupExpired(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.checkoutsRepo.delete as jest.Mock).toHaveBeenCalledWith("sess_abc");
    });

    it("falls back to session metadata slugs when no checkout record exists", async () => {
      const deps = makeDeps({
        checkoutsRepo: makeCheckoutsRepo({ get: jest.fn().mockResolvedValue(null) }),
      });
      setupExpired(deps);
      await createHandler(deps)(makeEvent());
      expect(deps.productsRepo.release as jest.Mock).toHaveBeenCalledWith(["bowl-1"], "sess_abc");
    });

    it("returns 200", async () => {
      const deps = makeDeps();
      setupExpired(deps);
      const result = await createHandler(deps)(makeEvent());
      expect(result).toMatchObject({ statusCode: 200, body: "ok" });
    });
  });

  describe("unknown event type", () => {
    it("returns 200 and does nothing", async () => {
      const deps = makeDeps({
        constructEvent: jest.fn().mockReturnValue({
          type: "payment_intent.created",
          data: { object: {} },
        }),
      });
      const result = await createHandler(deps)(makeEvent());
      expect(result).toMatchObject({ statusCode: 200 });
      expect(deps.ordersRepo.create as jest.Mock).not.toHaveBeenCalled();
      expect(deps.productsRepo.markSold as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
