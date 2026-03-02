import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export interface InquiryRecord {
  inquiryId: string;
  createdAt: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

export class InquiriesRepository {
  constructor(private ddb: DynamoDBDocumentClient, private tableName: string) {}

  async create(record: InquiryRecord): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
      })
    );
  }
}
