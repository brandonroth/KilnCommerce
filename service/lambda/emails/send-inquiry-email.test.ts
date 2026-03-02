import { Resend } from "resend";
import { sendInquiryEmail } from "./send-inquiry-email";
import type { InquiryRecord } from "../db/inquiries-repo";

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

function makeRecord(): InquiryRecord {
  return {
    inquiryId: "INQ-ABC123",
    createdAt: "2024-01-01T00:00:00.000Z",
    name: "Alice",
    email: "alice@example.com",
    subject: "custom order",
    message: "I'd like a custom bowl.",
  };
}

describe("sendInquiryEmail", () => {
  it("sends to ownerEmail with correct from", async () => {
    const { _send, ...deps } = makeDeps();
    await sendInquiryEmail(deps, makeRecord());
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      from: "orders@example.com",
      to: "owner@example.com",
    }));
  });

  it("subject contains name and subject category", async () => {
    const { _send, ...deps } = makeDeps();
    await sendInquiryEmail(deps, makeRecord());
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringMatching(/Alice.*custom order/),
    }));
  });

  it("body includes name, email, subject, and message", async () => {
    const { _send, ...deps } = makeDeps();
    await sendInquiryEmail(deps, makeRecord());
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("alice@example.com"),
    }));
    expect(_send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("I'd like a custom bowl."),
    }));
  });

  it("propagates Resend errors without swallowing", async () => {
    const send = jest.fn().mockResolvedValue({ data: null, error: { message: "Resend down" } });
    const { _send: _, ...deps } = makeDeps(send);
    await expect(sendInquiryEmail(deps, makeRecord())).rejects.toThrow("Resend down");
  });
});
