import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { AdminRepository } from "./db/admin-repo";
import { ProductsRepository } from "./db/products-repo";
import { OrdersRepository } from "./db/orders-repo";
import { SettingsRepository } from "./db/settings-repo";
import { SETTING_DEFAULTS } from "./settings";
import { logger } from "./logger";

/**
 * Product fields the admin may edit. Slug and sale state are never touched here —
 * those are managed by the checkout/webhook flow and the seed script.
 */
const EDITABLE_PRODUCT_FIELDS = new Set([
  "name", "price", "tagline", "description", "badge", "tags", "details",
  "weight", "length", "width", "height", "images",
]);

/** Fields required when creating a new product. */
const REQUIRED_NEW_PRODUCT_FIELDS = ["name", "price"];

/** Settings keys the admin may write. Prevents arbitrary key injection. */
const WRITABLE_SETTING_KEYS = new Set(Object.keys(SETTING_DEFAULTS));

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface AdminDeps {
  adminRepo: AdminRepository;
  productsRepo: ProductsRepository;
  ordersRepo: OrdersRepository;
  settingsRepo: SettingsRepository;
  /** Maps URL path param values to the DynamoDB table names they represent. */
  tableMap: Record<string, string | undefined>;
}

/**
 * Factory that creates the admin handler.
 * Auth is enforced at the API Gateway layer via Cognito JWT authorizer —
 * this handler only handles routing and delegates to repositories.
 */
export function createHandler({ adminRepo, productsRepo, ordersRepo, settingsRepo, tableMap }: AdminDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const method = event.requestContext.http.method;

    // Extract caller identity from JWT claims for audit logging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = ((event.requestContext as any).authorizer?.jwt?.claims ?? {}) as Record<string, string>;
    const caller = claims.email ?? claims.sub ?? "unknown";

    // ── PATCH /admin/products/{slug} — product field edit ─────────────────────

    if (method === "PATCH" && event.pathParameters?.slug) {
      const slug = event.pathParameters.slug;

      let updates: Record<string, unknown>;
      try {
        updates = JSON.parse(event.body ?? "{}") as Record<string, unknown>;
      } catch {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      // Strip fields not in the whitelist — prevents accidental writes to slug or sale state.
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([k]) => EDITABLE_PRODUCT_FIELDS.has(k))
      );

      if (!Object.keys(filtered).length) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "No editable fields provided" }) };
      }

      logger.info({ event: "admin_product_update", slug, fields: Object.keys(filtered), caller });

      try {
        await productsRepo.updateFields(slug, filtered);
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
      } catch (err) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
          return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Product not found" }) };
        }
        logger.error({ event: "admin_product_update_error", slug, error: String(err) });
        return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Update failed" }) };
      }
    }

    // ── PATCH /admin/orders/{orderId} — internal order notes ──────────────────

    if (method === "PATCH" && event.pathParameters?.orderId) {
      const orderId = event.pathParameters.orderId;

      let body: { notes?: unknown };
      try {
        body = JSON.parse(event.body ?? "{}") as { notes?: unknown };
      } catch {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000).trim() || null : null;

      logger.info({ event: "admin_order_notes", orderId, caller });

      try {
        await ordersRepo.updateNotes(orderId, notes);
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
      } catch (err) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
          return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Order not found" }) };
        }
        logger.error({ event: "admin_order_notes_error", orderId, error: String(err) });
        return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Update failed" }) };
      }
    }

    // ── POST /admin/products — create a new product ───────────────────────────

    if (method === "POST" && event.rawPath.endsWith("/products")) {
      let product: Record<string, unknown>;
      try {
        product = JSON.parse(event.body ?? "{}") as Record<string, unknown>;
      } catch {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      const missing = REQUIRED_NEW_PRODUCT_FIELDS.filter(
        (f) => !(f in product) || product[f] === "" || product[f] === 0
      );
      if (missing.length) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
        };
      }

      logger.info({ event: "admin_product_create", caller });

      try {
        const slug = await productsRepo.createProduct(product);
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, slug }) };
      } catch (err) {
        logger.error({ event: "admin_product_create_error", error: String(err) });
        return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Create failed" }) };
      }
    }

    // ── PUT /admin/settings/{key} — update a single setting ───────────────────

    if (method === "PUT" && event.pathParameters?.key) {
      const key = event.pathParameters.key;

      if (!WRITABLE_SETTING_KEYS.has(key)) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unknown setting key" }) };
      }

      let body: { value?: unknown };
      try {
        body = JSON.parse(event.body ?? "{}") as { value?: unknown };
      } catch {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      if (typeof body.value !== "string") {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "value must be a string" }) };
      }

      logger.info({ event: "admin_setting_update", key, caller });

      await settingsRepo.put(key, body.value);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    // ── GET /admin/settings — list all settings with defaults merged in ────────

    if (method === "GET" && event.rawPath.endsWith("/settings")) {
      const stored = await settingsRepo.getAll();
      // Merge stored values over defaults so the UI always sees every key
      const result = { ...SETTING_DEFAULTS, ...stored };
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
    }

    // ── GET /admin/{table} — table scan ───────────────────────────────────────

    const table = event.pathParameters?.table;
    const tableName = table && tableMap[table];

    if (!tableName) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: "Unknown table" }) };
    }

    logger.info({ event: "admin_scan", table, caller });

    const lastKeyParam = event.queryStringParameters?.lastKey;
    const statusParam  = event.queryStringParameters?.status;

    // For the products table, delegate to the status-aware paginator when a filter is requested,
    // so the DynamoDB FilterExpression is applied server-side rather than post-scan.
    const productStatus =
      statusParam === "available" ? "available" :
      statusParam === "sold"      ? "sold"      : undefined;

    try {
      const result = (table === "products" && productStatus)
        ? await productsRepo.getAll({ status: productStatus, lastKey: lastKeyParam })
        : await adminRepo.scan(tableName, lastKeyParam);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
    } catch (err) {
      logger.error({ event: "admin_scan_error", table, error: String(err) });
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Scan failed" }) };
    }
  };
}

export const handler = createHandler({
  adminRepo: new AdminRepository(ddb),
  productsRepo: new ProductsRepository(ddb, process.env.PRODUCTS_TABLE!),
  ordersRepo: new OrdersRepository(ddb, process.env.ORDERS_TABLE!),
  settingsRepo: new SettingsRepository(ddb, process.env.SETTINGS_TABLE!),
  tableMap: {
    products:      process.env.PRODUCTS_TABLE,
    orders:        process.env.ORDERS_TABLE,
    checkouts:     process.env.CHECKOUTS_TABLE,
    inquiries:     process.env.INQUIRIES_TABLE,
    subscriptions: process.env.SUBSCRIPTIONS_TABLE,
  },
});
