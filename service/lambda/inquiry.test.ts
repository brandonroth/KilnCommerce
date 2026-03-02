import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { Resend } from "resend";
import { createHandler, type InquiryDeps } from "./inquiry";
import type { InquiriesRepository } from "./db/inquiries-repo";

jest.mock("./emails/send-inquiry-email", () => ({
  sendInquiryEmail: jest.fn().mockResolvedValue(undefined),
}));

import { sendInquiryEmail } from "./emails/send-inquiry-email";

function makeEvent(body: unknown, method = "POST"): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method } },
    headers: {},
    body: body !== null ? JSON.stringify(body) : null,
    pathParameters: {},
  } as unknown as APIGatewayProxyEventV2;
}

const validBody = {
  name: "Alice",
  email: "alice@example.com",
  subject: "custom order",
  message: "I'd like a custom bowl.",
};

function makeRepo(overrides: Partial<InquiriesRepository> = {}): InquiriesRepository {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as InquiriesRepository;
}

function makeDeps(overrides: Partial<InquiryDeps> = {}): InquiryDeps {
  return {
    inquiriesRepo: makeRepo(),
    resend: { emails: { send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }) } } as unknown as Resend,
    fromEmail: "from@example.com",
    ownerEmail: "owner@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("inquiry handler", () => {
  it("returns 200 with { ok: true } on success", async () => {
    const result = await createHandler(makeDeps())(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 200 });
    expect(JSON.parse((result as { body: string }).body)).toEqual({ ok: true });
  });

  it("returns 200 for OPTIONS preflight", async () => {
    const result = await createHandler(makeDeps())(makeEvent(null, "OPTIONS"));
    expect(result).toMatchObject({ statusCode: 200 });
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = await createHandler(makeDeps())({
      ...makeEvent(null),
      body: "not-json",
    } as unknown as APIGatewayProxyEventV2);
    expect(result).toMatchObject({ statusCode: 400 });
    expect(JSON.parse((result as { body: string }).body)).toMatchObject({ error: "Invalid JSON" });
  });

  it.each(["name", "email", "subject", "message"] as const)(
    "returns 400 when %s is missing",
    async (field) => {
      const body = { ...validBody, [field]: "" };
      const result = await createHandler(makeDeps())(makeEvent(body));
      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as { body: string }).body)).toMatchObject({ error: "Missing required fields" });
    }
  );

  it("calls inquiriesRepo.create with correct record shape", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    expect(deps.inquiriesRepo.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: expect.stringMatching(/^INQ-/),
        createdAt: expect.any(String),
        name: "Alice",
        email: "alice@example.com",
        subject: "custom order",
        message: "I'd like a custom bowl.",
      })
    );
  });

  it("calls sendInquiryEmail with correct args", async () => {
    const deps = makeDeps();
    await createHandler(deps)(makeEvent(validBody));
    expect(sendInquiryEmail).toHaveBeenCalledWith(
      { resend: deps.resend, fromEmail: deps.fromEmail, ownerEmail: deps.ownerEmail },
      expect.objectContaining({ email: "alice@example.com", subject: "custom order" })
    );
  });

  it("returns 500 and logs error when repo throws", async () => {
    const deps = makeDeps({
      inquiriesRepo: makeRepo({ create: jest.fn().mockRejectedValue(new Error("DDB error")) }),
    });
    const result = await createHandler(deps)(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 500 });
  });

  it("returns 500 and logs error when email throws", async () => {
    (sendInquiryEmail as jest.Mock).mockRejectedValueOnce(new Error("Resend error"));
    const result = await createHandler(makeDeps())(makeEvent(validBody));
    expect(result).toMatchObject({ statusCode: 500 });
  });

  it("includes CORS headers in response", async () => {
    const result = await createHandler(makeDeps())(makeEvent(validBody)) as { headers: Record<string, string> };
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": "https://test.example.com",
    });
  });
});
