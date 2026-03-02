import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { InquiriesRepository, type InquiryRecord } from "./inquiries-repo";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "test-inquiries";

function makeRepo() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  return new InquiriesRepository(client, TABLE);
}

beforeEach(() => ddbMock.reset());

const record: InquiryRecord = {
  inquiryId: "INQ-ABC123",
  createdAt: "2024-01-01T00:00:00.000Z",
  name: "Alice",
  email: "alice@example.com",
  subject: "custom order",
  message: "I'd like a custom bowl.",
};

describe("InquiriesRepository", () => {
  describe("create", () => {
    it("puts record with correct TableName and Item", async () => {
      ddbMock.on(PutCommand).resolves({});
      await makeRepo().create(record);
      expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: TABLE,
        Item: record,
      });
    });

    it("propagates DynamoDB errors", async () => {
      ddbMock.on(PutCommand).rejects(new Error("DDB down"));
      await expect(makeRepo().create(record)).rejects.toThrow("DDB down");
    });
  });
});
