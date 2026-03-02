import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { CheckoutsRepository, type CheckoutRecord } from "./checkouts-repo";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "test-checkouts";

function makeRepo() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  return new CheckoutsRepository(client, TABLE);
}

beforeEach(() => ddbMock.reset());

const record: CheckoutRecord = {
  sessionId: "sess_abc",
  createdAt: "2024-01-01T00:00:00.000Z",
  expiresAt: 1700000000,
  customer: { name: "Alice", email: "alice@example.com" },
  items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
  subtotal: 25,
  tax: 1.86,
  total: 26.86,
};

describe("CheckoutsRepository", () => {
  describe("create", () => {
    it("puts record with idempotency condition expression", async () => {
      ddbMock.on(PutCommand).resolves({});
      await makeRepo().create(record);
      expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: TABLE,
        Item: record,
        ConditionExpression: "attribute_not_exists(sessionId)",
      });
    });
  });

  describe("get", () => {
    it("returns record when found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: record });
      const result = await makeRepo().get("sess_abc");
      expect(result).toEqual(record);
    });

    it("returns null when not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      const result = await makeRepo().get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("sends DeleteCommand with correct key", async () => {
      ddbMock.on(DeleteCommand).resolves({});
      await makeRepo().delete("sess_abc");
      expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
        TableName: TABLE,
        Key: { sessionId: "sess_abc" },
      });
    });
  });
});
