import { Resend } from "resend";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { createHandler } from "./email";

function makeSend() {
  return jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });
}

function makeDeps(send = makeSend()) {
  return {
    resend: { emails: { send } } as unknown as Resend,
    fromEmail: "orders@example.com",
    ownerEmail: "owner@example.com",
    supportEmail: "support@example.com",
    siteUrl: "https://example.com",
    _send: send,
  };
}

function makeOrder() {
  return {
    orderId: "ORD-ABC123",
    customer: { name: "Alice", email: "alice@example.com", phone: null, shipping: null },
    items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
    subtotal: 25,
    total: 25,
  };
}

function makeInsertRecord(item: object): DynamoDBStreamEvent["Records"][number] {
  return {
    eventName: "INSERT",
    dynamodb: { NewImage: marshall(item) as Record<string, { S?: string }> },
  } as unknown as DynamoDBStreamEvent["Records"][number];
}

function makeEvent(records: DynamoDBStreamEvent["Records"]): DynamoDBStreamEvent {
  return { Records: records };
}

describe("email handler", () => {
  it("skips non-INSERT records", async () => {
    const { _send, ...deps } = makeDeps();
    const handler = createHandler(deps);
    await handler(makeEvent([
      { eventName: "MODIFY", dynamodb: { NewImage: marshall(makeOrder()) } } as unknown as DynamoDBStreamEvent["Records"][number],
      { eventName: "REMOVE", dynamodb: {} } as unknown as DynamoDBStreamEvent["Records"][number],
    ]));
    expect(_send).not.toHaveBeenCalled();
  });

  it("sends two emails per INSERT", async () => {
    const { _send, ...deps } = makeDeps();
    const handler = createHandler(deps);
    await handler(makeEvent([makeInsertRecord(makeOrder())]));
    expect(_send).toHaveBeenCalledTimes(2);
  });

  it("sends store email to ownerEmail", async () => {
    const { _send, ...deps } = makeDeps();
    const handler = createHandler(deps);
    await handler(makeEvent([makeInsertRecord(makeOrder())]));
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com" }));
  });

  it("sends customer email to customer.email", async () => {
    const { _send, ...deps } = makeDeps();
    const handler = createHandler(deps);
    await handler(makeEvent([makeInsertRecord(makeOrder())]));
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@example.com" }));
  });

  it("continues if store email throws, still sends customer email", async () => {
    let callCount = 0;
    const send = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("store email failed");
      return { data: { id: "test-id" }, error: null };
    });
    const { _send: _, ...deps } = makeDeps(send);
    const handler = createHandler(deps);
    await expect(handler(makeEvent([makeInsertRecord(makeOrder())]))).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("continues if customer email throws", async () => {
    let callCount = 0;
    const send = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error("customer email failed");
      return { data: { id: "test-id" }, error: null };
    });
    const { _send: _, ...deps } = makeDeps(send);
    const handler = createHandler(deps);
    await expect(handler(makeEvent([makeInsertRecord(makeOrder())]))).resolves.toBeUndefined();
  });
});
