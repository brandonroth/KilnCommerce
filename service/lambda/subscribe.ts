import { Resend } from "resend";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { SubscriptionsRepository } from "./db/subscriptions-repo";
import { SettingsRepository } from "./db/settings-repo";
import { sendWelcomeEmail } from "./emails/send-welcome-email";
import { logger } from "./logger";
import { sanitizeEmail } from "./sanitize";
import { corsHeaders } from "./cors";

interface SubscribeBody {
  email?: unknown;
  website?: unknown; // honeypot — bots fill this, humans don't
}

export interface SubscribeDeps {
  subscriptionsRepo: SubscriptionsRepository;
  settingsRepo: SettingsRepository;
  resend: Resend;
  fromEmail: string;
}

export function createHandler({ subscriptionsRepo, settingsRepo, resend, fromEmail }: SubscribeDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(event), body: "" };
    }

    let body: SubscribeBody;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    if (body.website) {
      // Honeypot triggered — silently succeed without doing anything
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
    }

    const email = sanitizeEmail(body.email);
    if (!email) {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: "Valid email required" }) };
    }

    logger.info({ event: "subscribe_start", email });

    try {
      const [storeName, storeSignature, subject, body] = await Promise.all([
        settingsRepo.get("store.name"),
        settingsRepo.get("store.signature"),
        settingsRepo.get("email.welcome.subject"),
        settingsRepo.get("email.welcome.body"),
      ]);
      await subscriptionsRepo.create({ email, subscribedAt: new Date().toISOString() });
      await sendWelcomeEmail({ resend, fromEmail, storeName, storeSignature, subject, body }, email);
      logger.info({ event: "subscribe_success", email });
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
    } catch (err: unknown) {
      logger.error({ event: "subscribe_error", error: String(err) });
      return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: "Subscription failed" }) };
    }
  };
}

export const handler = createHandler({
  subscriptionsRepo: new SubscriptionsRepository(ddb, process.env.SUBSCRIPTIONS_TABLE!),
  settingsRepo: new SettingsRepository(ddb, process.env.SETTINGS_TABLE!),
  resend: new Resend(process.env.RESEND_API_KEY!),
  fromEmail: process.env.FROM_EMAIL!,
});
