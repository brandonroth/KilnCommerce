import { Resend } from "resend";
import type { InquiryRecord } from "../db/inquiries-repo";
import { sendEmail } from "./send-email";

interface SendInquiryEmailDeps {
  resend: Resend;
  fromEmail: string;
  ownerEmail: string;
}

export async function sendInquiryEmail(deps: SendInquiryEmailDeps, record: InquiryRecord): Promise<void> {
  await sendEmail(
    { resend: deps.resend, fromEmail: deps.fromEmail },
    {
      to: deps.ownerEmail,
      subject: `Inquiry from ${record.name} — ${record.subject}`,
      body: [
        `New inquiry received.`,
        ``,
        `Name:    ${record.name}`,
        `Email:   ${record.email}`,
        `Subject: ${record.subject}`,
        ``,
        `Message:`,
        record.message,
      ].join("\n"),
    }
  );
}
