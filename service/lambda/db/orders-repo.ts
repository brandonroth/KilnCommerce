import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { TaxBreakdown } from "../tax";

export interface ShippingInfo {
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingUrl: string;
  cost: number;
  shippedAt: string;
}

export interface CreateOrderInput {
  orderId: string;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
    shipping?: object | null;
  };
  items: { slug: string; name: string; price: number }[];
  subtotal: number;
  tax: TaxBreakdown;
  total: number;
  selectedShipping?: { amount: number; rateId?: string };
}

export class OrdersRepository {
  constructor(
    private ddb: DynamoDBDocumentClient,
    private ordersTable: string
  ) {}

  async getById(orderId: string): Promise<Record<string, unknown> | null> {
    const { Item } = await this.ddb.send(
      new GetCommand({ TableName: this.ordersTable, Key: { orderId } })
    );
    return (Item as Record<string, unknown>) ?? null;
  }

  /** Adds shipping info to an existing order. Throws ConditionalCheckFailedException if orderId not found. */
  async addShipping(orderId: string, shipping: ShippingInfo): Promise<void> {
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.ordersTable,
        Key: { orderId },
        UpdateExpression: "SET shipping = :shipping",
        ExpressionAttributeValues: { ":shipping": shipping },
        ConditionExpression: "attribute_exists(orderId)",
      })
    );
  }

  /**
   * Set or clear an internal admin note on an order.
   * Passing null removes the field entirely.
   * Throws ConditionalCheckFailedException if the orderId doesn't exist.
   */
  async updateNotes(orderId: string, notes: string | null): Promise<void> {
    await this.ddb.send(new UpdateCommand({
      TableName: this.ordersTable,
      Key: { orderId },
      UpdateExpression: notes ? "SET #notes = :notes" : "REMOVE #notes",
      ExpressionAttributeNames: { "#notes": "notes" },
      ...(notes ? { ExpressionAttributeValues: { ":notes": notes } } : {}),
      ConditionExpression: "attribute_exists(orderId)",
    }));
  }

  async create(input: CreateOrderInput): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.ordersTable,
        Item: {
          orderId: input.orderId,
          createdAt: new Date().toISOString(),
          customer: input.customer,
          items: input.items,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          ...(input.selectedShipping && { selectedShipping: input.selectedShipping }),
        },
        ConditionExpression: "attribute_not_exists(orderId)",
      })
    );
  }
}
