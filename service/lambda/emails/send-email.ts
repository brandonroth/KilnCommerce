import { Resend } from "resend";

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  /** Sets the Reply-To header so recipient replies go to this address. */
  replyTo?: string;
  /** Additional headers (e.g. In-Reply-To, References for threading). */
  headers?: Record<string, string>;
}

export interface SendEmailDeps {
  resend: Resend;
  fromEmail: string;
}

export async function sendEmail(deps: SendEmailDeps, payload: EmailPayload): Promise<void> {
  const { error } = await deps.resend.emails.send({
    from: deps.fromEmail,
    to: payload.to,
    subject: payload.subject,
    text: payload.body,
    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    ...(payload.headers ? { headers: payload.headers } : {}),
  });
  if (error) throw new Error(error.message);
}
