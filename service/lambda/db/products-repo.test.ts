import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  BatchGetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { ProductsRepository } from "./products-repo";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "test-products";

function makeRepo() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  return new ProductsRepository(client, TABLE);
}

beforeEach(() => ddbMock.reset());

const product = {
  slug: "bowl-1",
  name: "Bowl 1",
  price: 25,
  images: [],
  tagline: "Nice bowl",
  tags: [],
  details: [],
  description: "A bowl",
};

describe("ProductsRepository", () => {
  describe("getBySlug", () => {
    it("returns product when found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: product });
      const result = await makeRepo().getBySlug("bowl-1");
      expect(result).toEqual(product);
      expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
        TableName: TABLE,
        Key: { slug: "bowl-1" },
      });
    });

    it("returns null when not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      const result = await makeRepo().getBySlug("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getAll", () => {
    it("returns items with no lastKey when scan is complete", async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [product] });
      const result = await makeRepo().getAll();
      expect(result).toEqual({ items: [product], lastKey: undefined });
    });

    it("returns empty items array when table is empty", async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      const result = await makeRepo().getAll();
      expect(result).toEqual({ items: [], lastKey: undefined });
    });

    it("returns base64-encoded lastKey when more pages exist", async () => {
      const lastEvaluatedKey = { slug: "bowl-1" };
      ddbMock.on(ScanCommand).resolves({ Items: [product], LastEvaluatedKey: lastEvaluatedKey });
      const result = await makeRepo().getAll({ limit: 1 });
      expect(result.lastKey).toBe(Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64"));
    });

    it("applies available FilterExpression by default", async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      await makeRepo().getAll();
      expect(ddbMock).toHaveReceivedCommandWith(ScanCommand, {
        FilterExpression: "attribute_not_exists(orderId) AND attribute_not_exists(pendingSessionId)",
      });
    });

    it("applies sold FilterExpression when status=sold", async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      await makeRepo().getAll({ status: "sold" });
      expect(ddbMock).toHaveReceivedCommandWith(ScanCommand, {
        FilterExpression: "attribute_exists(orderId)",
      });
    });
  });

  describe("getBySlugs", () => {
    it("returns matched products", async () => {
      ddbMock.on(BatchGetCommand).resolves({ Responses: { [TABLE]: [product] } });
      const result = await makeRepo().getBySlugs(["bowl-1"]);
      expect(result).toEqual([product]);
    });

    it("returns empty array when table key absent in response", async () => {
      ddbMock.on(BatchGetCommand).resolves({ Responses: {} });
      const result = await makeRepo().getBySlugs(["bowl-1"]);
      expect(result).toEqual([]);
    });
  });

  describe("reserve", () => {
    it("sends TransactWrite with condition expression for each slug", async () => {
      ddbMock.on(TransactWriteCommand).resolves({});
      await makeRepo().reserve(["bowl-1", "bowl-2"], "sess_123");
      expect(ddbMock).toHaveReceivedCommandWith(TransactWriteCommand, {
        TransactItems: [
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: TABLE,
              Key: { slug: "bowl-1" },
              ConditionExpression:
                "attribute_not_exists(orderId) AND attribute_not_exists(pendingSessionId)",
            }),
          }),
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: TABLE,
              Key: { slug: "bowl-2" },
            }),
          }),
        ],
      });
    });

    it("propagates TransactionCanceledException for race conditions", async () => {
      const err = Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
      ddbMock.on(TransactWriteCommand).rejects(err);
      await expect(makeRepo().reserve(["bowl-1"], "sess_123")).rejects.toThrow("conflict");
    });
  });

  describe("markSold", () => {
    it("sends UpdateCommand setting orderId and removing pendingSessionId for each slug", async () => {
      ddbMock.on(UpdateCommand).resolves({});
      await makeRepo().markSold(["bowl-1", "bowl-2"], "ORD-123");
      expect(ddbMock).toHaveReceivedNthCommandWith(1, UpdateCommand, {
        TableName: TABLE,
        Key: { slug: "bowl-1" },
        UpdateExpression: "SET orderId = :orderId REMOVE pendingSessionId",
        ExpressionAttributeValues: { ":orderId": "ORD-123" },
      });
      expect(ddbMock).toHaveReceivedNthCommandWith(2, UpdateCommand, {
        TableName: TABLE,
        Key: { slug: "bowl-2" },
      });
    });
  });

  describe("release", () => {
    it("sends UpdateCommand removing pendingSessionId with session condition", async () => {
      ddbMock.on(UpdateCommand).resolves({});
      await makeRepo().release(["bowl-1"], "cs_test");
      expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
        TableName: TABLE,
        Key: { slug: "bowl-1" },
        UpdateExpression: "REMOVE pendingSessionId",
        ConditionExpression: "pendingSessionId = :sid",
        ExpressionAttributeValues: { ":sid": "cs_test" },
      });
    });
  });
});
