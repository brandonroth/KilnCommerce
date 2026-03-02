import { DynamoDBDocumentClient, GetCommand, DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export interface CheckoutItem {
  slug: string;
  name: string;
  price: number;
}

export interface CheckoutRecord {
  sessionId: string;
  createdAt: string;
  expiresAt: number;
  customer?: { name: string; email: string };
  items: CheckoutItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export class CheckoutsRepository {
  constructor(private ddb: DynamoDBDocumentClient, private tableName: string) {}

  async create(record: CheckoutRecord): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(sessionId)",
      })
    );
  }

  async get(sessionId: string): Promise<CheckoutRecord | null> {
    const { Item } = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: { sessionId } })
    );
    return (Item as CheckoutRecord) ?? null;
  }

  async delete(sessionId: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({ TableName: this.tableName, Key: { sessionId } })
    );
  }
}
