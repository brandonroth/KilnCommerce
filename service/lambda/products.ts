import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { ProductsRepository } from "./db/products-repo";
import { logger } from "./logger";
import { corsHeaders } from "./cors";

const MAX_LIMIT = 100;

interface ProductsDeps {
  productsRepo: ProductsRepository;
}

export function createHandler({ productsRepo }: ProductsDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const slug = event.pathParameters?.slug;

    if (slug) {
      const product = await productsRepo.getBySlug(slug);
      if (!product) {
        logger.warn({ event: "product_not_found", slug });
        return { statusCode: 404, headers: corsHeaders(event), body: JSON.stringify({ error: "Not found" }) };
      }
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(product) };
    }

    const qs = event.queryStringParameters ?? {};

    const rawStatus = qs.status;
    const status = rawStatus === "sold" ? "sold" : "available";

    const rawLimit = parseInt(qs.limit ?? "", 10);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : MAX_LIMIT;

    const lastKey = qs.lastKey;

    const result = await productsRepo.getAll({ status, limit, lastKey });
    logger.info({ event: "products_listed", status, count: result.items.length, paginated: !!result.lastKey });
    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(result) };
  };
}

export const handler = createHandler({
  productsRepo: new ProductsRepository(ddb, process.env.TABLE_NAME!),
});
