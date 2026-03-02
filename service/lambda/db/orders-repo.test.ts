import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { OrdersRepository, type CreateOrderInput } from "./orders-repo";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "test-orders";

function makeRepo() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  return new OrdersRepository(client, TABLE);
}

beforeEach(() => ddbMock.reset());

const input: CreateOrderInput = {
  orderId: "ORD-XYZ",
  customer: { name: "Bob", email: "bob@example.com", phone: null, shipping: null },
  items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
  subtotal: 25,
  tax: { lines: [], label: "Sales Tax (7.45%)", total: 1.86 },
  total: 26.86,
};

describe("OrdersRepository", () => {
  describe("create", () => {
    it("puts order with idempotency condition expression", async () => {
      ddbMock.on(PutCommand).resolves({});
      await makeRepo().create(input);
      expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
        TableName: TABLE,
        Item: expect.objectContaining({
          orderId: "ORD-XYZ",
          customer: input.customer,
          items: input.items,
          subtotal: 25,
          tax: expect.objectContaining({ total: 1.86 }),
          total: 26.86,
          createdAt: expect.any(String),
        }),
        ConditionExpression: "attribute_not_exists(orderId)",
      });
    });

    it("includes a createdAt ISO timestamp", async () => {
      ddbMock.on(PutCommand).resolves({});
      await makeRepo().create(input);
      const call = ddbMock.commandCalls(PutCommand)[0];
      expect(call.args[0].input.Item?.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });
});
