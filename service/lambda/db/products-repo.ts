import { DynamoDBDocumentClient, GetCommand, ScanCommand, BatchGetCommand, UpdateCommand, PutCommand, TransactWriteCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

export interface Product {
  slug: string;
  name: string;
  price: number;
  orderId?: string;
  pendingSessionId?: string;
  images: string[];
  tagline: string;
  tags: string[];
  details: string[];
  description: string;
  hero?: string;
  badge?: string;
  /** Shipping weight in ounces */
  weight: number;
  /** Shipping dimensions in inches */
  length: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

export class ProductsRepository {
  constructor(private ddb: DynamoDBDocumentClient, private tableName: string) {}

  async getBySlug(slug: string): Promise<Product | null> {
    const { Item } = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: { slug } })
    );
    return (Item as Product) ?? null;
  }

  /**
   * Scan products with optional server-side filtering and pagination.
   * Note: DynamoDB's Limit bounds items _scanned_, not items returned after filtering,
   * so a page may contain fewer items than the requested limit.
   *
   * @param status  "available" (default) | "sold" — filters applied in DynamoDB
   * @param limit   max items to scan per page (default 100)
   * @param lastKey base64-encoded pagination cursor from a previous response
   */
  async getAll(options: {
    status?: "available" | "sold";
    limit?: number;
    lastKey?: string;
  } = {}): Promise<{ items: Product[]; lastKey?: string }> {
    const { status = "available", limit = 100, lastKey } = options;

    const filterExpressions: Record<string, string> = {
      available: "attribute_not_exists(orderId) AND attribute_not_exists(pendingSessionId)",
      sold:      "attribute_exists(orderId)",
    };

    const params: ScanCommandInput = {
      TableName: this.tableName,
      Limit: limit,
      FilterExpression: filterExpressions[status],
    };

    if (lastKey) {
      params.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastKey, "base64").toString("utf-8")
      ) as Record<string, unknown>;
    }

    const { Items = [], LastEvaluatedKey } = await this.ddb.send(new ScanCommand(params));

    return {
      items: Items as Product[],
      lastKey: LastEvaluatedKey
        ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64")
        : undefined,
    };
  }

  async getBySlugs(slugs: string[]): Promise<Product[]> {
    const { Responses } = await this.ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: slugs.map((slug) => ({ slug })),
          },
        },
      })
    );
    return (Responses?.[this.tableName] ?? []) as Product[];
  }

  /**
   * Update arbitrary content fields on a product. Builds a parameterised
   * UpdateExpression so field names never clash with DynamoDB reserved words.
   * Throws ConditionalCheckFailedException if the slug doesn't exist.
   */
  /**
   * Update arbitrary content fields on a product. Automatically stamps `updatedAt`.
   * Throws ConditionalCheckFailedException if the slug doesn't exist.
   */
  async updateFields(slug: string, fields: Record<string, unknown>): Promise<void> {
    if (!Object.keys(fields).length) throw new Error("No fields to update");

    // Inject updatedAt alongside caller-supplied fields
    const stamped: Record<string, unknown> = { ...fields, updatedAt: new Date().toISOString() };
    const keys = Object.keys(stamped);

    const updateExpr = "SET " + keys.map((_, i) => `#f${i} = :v${i}`).join(", ");
    const exprAttrNames = Object.fromEntries(keys.map((k, i) => [`#f${i}`, k]));
    const exprAttrValues = Object.fromEntries(keys.map((k, i) => [`:v${i}`, stamped[k]]));

    await this.ddb.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { slug },
      ConditionExpression: "attribute_exists(slug)",
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
    }));
  }

  /**
   * Create a new product. Slug is auto-generated as a UUID — callers must not supply one.
   * Returns the generated slug so the caller can reference the new record.
   */
  async createProduct(product: Record<string, unknown>): Promise<string> {
    const slug = randomUUID();
    const now = new Date().toISOString();
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...product, slug, createdAt: now, updatedAt: now },
    }));
    return slug;
  }

  async reserve(slugs: string[], sessionId: string): Promise<void> {
    await this.ddb.send(
      new TransactWriteCommand({
        TransactItems: slugs.map((slug) => ({
          Update: {
            TableName: this.tableName,
            Key: { slug },
            UpdateExpression: "SET pendingSessionId = :sid",
            ExpressionAttributeValues: { ":sid": sessionId },
            ConditionExpression: "attribute_not_exists(orderId) AND attribute_not_exists(pendingSessionId)",
          },
        })),
      })
    );
  }

  /**
   * Mark items as sold. Idempotent: if the item already has the same orderId, succeeds silently.
   * Throws ConditionalCheckFailedException if the item was sold to a different order.
   */
  async markSold(slugs: string[], orderId: string): Promise<void> {
    await Promise.all(
      slugs.map((slug) =>
        this.ddb.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { slug },
            UpdateExpression: "SET orderId = :orderId REMOVE pendingSessionId",
            ConditionExpression: "attribute_not_exists(orderId) OR orderId = :orderId",
            ExpressionAttributeValues: { ":orderId": orderId },
          })
        )
      )
    );
  }

  /**
   * Release reserved items. Only removes pendingSessionId if it matches the given sessionId,
   * preventing a race where a newer reservation would be incorrectly cleared.
   * Throws ConditionalCheckFailedException if the item's session doesn't match.
   */
  async release(slugs: string[], sessionId: string): Promise<void> {
    await Promise.all(
      slugs.map((slug) =>
        this.ddb.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { slug },
            UpdateExpression: "REMOVE pendingSessionId",
            ConditionExpression: "pendingSessionId = :sid",
            ExpressionAttributeValues: { ":sid": sessionId },
          })
        )
      )
    );
  }
}
