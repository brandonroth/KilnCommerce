import { Resend } from "resend";
import { STORE_NAME, STORE_SIGNATURE } from "../config";
import { SETTING_DEFAULTS } from "../settings";
import { sendEmail } from "./send-email";

interface SendWelcomeEmailDeps {
  resend: Resend;
  fromEmail: string;
  /** Store display name shown in email sign-off. Defaults to the hardcoded value. */
  storeName?: string;
  /** Email signature line shown above the store name. Defaults to the hardcoded value. */
  storeSignature?: string;
  /** Email subject line. Defaults to the value in SETTING_DEFAULTS. */
  subject?: string;
  /** Main body copy above the signature. Defaults to the value in SETTING_DEFAULTS. */
  body?: string;
}

export async function sendWelcomeEmail(deps: SendWelcomeEmailDeps, email: string): Promise<void> {
  const name      = deps.storeName      ?? STORE_NAME;
  const signature = deps.storeSignature ?? STORE_SIGNATURE;
  const subject   = deps.subject        ?? SETTING_DEFAULTS["email.welcome.subject"];
  const bodyIntro = deps.body           ?? SETTING_DEFAULTS["email.welcome.body"];

  await sendEmail(
    { resend: deps.resend, fromEmail: deps.fromEmail },
    {
      to: email,
      subject,
      body: [
        bodyIntro,
        ``,
        signature,
        name,
        ``,
        `To unsubscribe, reply with "unsubscribe" and I'll remove you right away.`,
      ].join("\n"),
    }
  );
}
