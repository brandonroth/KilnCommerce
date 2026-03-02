import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * Repository for store-level configuration stored in DynamoDB.
 * Each item has a `settingKey` (partition key) and `value` (string).
 *
 * All values are stored as strings. JSON values (e.g. store.social) must be
 * serialised by the caller before writing and deserialised after reading.
 */
export class SettingsRepository {
  constructor(
    private ddb: DynamoDBDocumentClient,
    private tableName: string
  ) {}

  /** Returns the value for the given key, or undefined if not set. */
  async get(key: string): Promise<string | undefined> {
    const result = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: { settingKey: key } })
    );
    const item = result.Item as { settingKey: string; value: string } | undefined;
    return item?.value;
  }

  /** Writes (or overwrites) the value for the given key. */
  async put(key: string, value: string): Promise<void> {
    await this.ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { settingKey: key, value, updatedAt: new Date().toISOString() },
      })
    );
  }

  /** Returns all settings as a key→value map. */
  async getAll(): Promise<Record<string, string>> {
    const result = await this.ddb.send(
      new ScanCommand({ TableName: this.tableName })
    );
    const entries = (result.Items ?? []) as { settingKey: string; value: string }[];
    return Object.fromEntries(entries.map((item) => [item.settingKey, item.value]));
  }
}
