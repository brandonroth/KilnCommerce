import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export interface ScanResult {
  items: Record<string, unknown>[];
  lastKey?: string;
}

/**
 * Generic admin repository for read-only table scans across any table.
 * Used by the admin console to page through records for inspection.
 */
export class AdminRepository {
  constructor(private ddb: DynamoDBDocumentClient) {}

  async scan(tableName: string, lastKey?: string): Promise<ScanResult> {
    let exclusiveStartKey: Record<string, unknown> | undefined;

    if (lastKey) {
      exclusiveStartKey = JSON.parse(
        Buffer.from(lastKey, "base64").toString("utf-8")
      ) as Record<string, unknown>;
    }

    const result = await this.ddb.send(
      new ScanCommand({
        TableName: tableName,
        Limit: 100,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      })
    );

    const nextKey = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

    return {
      items: (result.Items ?? []) as Record<string, unknown>[],
      ...(nextKey ? { lastKey: nextKey } : {}),
    };
  }
}
