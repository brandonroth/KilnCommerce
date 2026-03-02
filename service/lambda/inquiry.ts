import { Resend } from "resend";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { InquiriesRepository } from "./db/inquiries-repo";
import { sendInquiryEmail } from "./emails/send-inquiry-email";
import { logger } from "./logger";
import { sanitizeEmail, sanitizeString, sanitizeEnum } from "./sanitize";
import { corsHeaders } from "./cors";

const INQUIRY_SUBJECTS = [
  "just saying hi",
  "custom order",
  "wholesale / stockist",
  "collab idea",
  "press / media",
] as const;

interface InquiryBody {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown; // honeypot — bots fill this, humans don't
}

export interface InquiryDeps {
  inquiriesRepo: InquiriesRepository;
  resend: Resend;
  fromEmail: string;
  ownerEmail: string;
}

export function createHandler({ inquiriesRepo, resend, fromEmail, ownerEmail }: InquiryDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(event), body: "" };
    }

    let body: InquiryBody;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    if (body.website) {
      // Honeypot triggered — silently succeed without doing anything
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
    }

    const name = sanitizeString(body.name, 100);
    const email = sanitizeEmail(body.email);
    const subject = sanitizeEnum(body.subject, INQUIRY_SUBJECTS);
    const message = sanitizeString(body.message, 4000);

    if (!name || !email || !subject || !message) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    logger.info({ event: "inquiry_start", email, subject });

    const inquiryId = `INQ-${Date.now().toString(36).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const record = { inquiryId, createdAt, name, email, subject, message };

    try {
      await inquiriesRepo.create(record);
      await sendInquiryEmail({ resend, fromEmail, ownerEmail }, record);
      logger.info({ event: "inquiry_success", inquiryId });
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
    } catch (err: unknown) {
      logger.error({ event: "inquiry_error", error: String(err) });
      return {
        statusCode: 500,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: "Inquiry submission failed" }),
      };
    }
  };
}

export const handler = createHandler({
  inquiriesRepo: new InquiriesRepository(ddb, process.env.INQUIRIES_TABLE!),
  resend: new Resend(process.env.RESEND_API_KEY!),
  fromEmail: process.env.FROM_EMAIL!,
  ownerEmail: process.env.OWNER_EMAIL!,
});
