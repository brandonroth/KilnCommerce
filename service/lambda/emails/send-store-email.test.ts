import { Resend } from "resend";
import { createSendStoreEmail } from "./send-store-email";
import type { CreateOrderInput } from "../db/orders-repo";

function makeSend() {
  return jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });
}

function makeDeps(send = makeSend()) {
  return {
    resend: { emails: { send } } as unknown as Resend,
    fromEmail: "orders@example.com",
    ownerEmail: "owner@example.com",
    _send: send,
  };
}

function makeOrder(): CreateOrderInput {
  return {
    orderId: "ORD-ABC123",
    customer: { name: "Alice", email: "alice@example.com", phone: null, shipping: null },
    items: [{ slug: "bowl-1", name: "Bowl 1", price: 25 }],
    subtotal: 25,
    tax: { lines: [], label: "Sales Tax (7.45%)", total: 1.86 },
    total: 26.86,
  };
}

describe("createSendStoreEmail", () => {
  it("sends to ownerEmail with correct from and subject", async () => {
    const { _send, ...deps } = makeDeps();
    const send = createSendStoreEmail(deps);
    await send(makeOrder());
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      from: "orders@example.com",
      to: "owner@example.com",
      subject: expect.stringContaining("Payment received"),
    }));
  });

  it("includes customer name, email, and orderId in body", async () => {
    const { _send, ...deps } = makeDeps();
    const send = createSendStoreEmail(deps);
    await send(makeOrder());
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("ORD-ABC123"),
    }));
  });

  it("propagates Resend errors without swallowing", async () => {
    const send = jest.fn().mockResolvedValue({ data: null, error: { message: "Resend down" } });
    const { _send: _, ...deps } = makeDeps(send);
    const sendEmail = createSendStoreEmail(deps);
    await expect(sendEmail(makeOrder())).rejects.toThrow("Resend down");
  });
});
