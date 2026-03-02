import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export interface SubscriptionRecord {
  email: string;
  subscribedAt: string;
}

export class SubscriptionsRepository {
  constructor(private ddb: DynamoDBDocumentClient, private tableName: string) {}

  async create(record: SubscriptionRecord): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
      })
    );
  }
}
