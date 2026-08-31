import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getCompany } from "@/lib/settings";
import { renderTemplate } from "@/lib/services/templates";
import type { DocumentType } from "@/generated/prisma";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  templateCode: string;
  to: string;
  cc?: string;
  bcc?: string;
  variables?: Record<string, string | number | undefined>;
  attachments?: MailAttachment[];
  docType?: DocumentType;
  recordId?: string;
  recordNumber?: string;
  customerId?: string;
  sentById?: string;
  /** Overrides the stored template subject/body when supplied. */
  override?: { subject?: string; bodyHtml?: string };
}

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (env.mail.driver !== "SMTP") return null;
  if (!env.mail.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

export async function emailConfigured(): Promise<boolean> {
  return (
    env.mail.driver === "SMTP" &&
    Boolean(env.mail.host && env.mail.port && env.mail.user && env.mail.password && env.mail.fromEmail)
  );
}

async function companyVariables() {
  const c = await getCompany();
  const address = [c.addressLine1, c.addressLine2, c.city, c.state, c.pinCode].filter(Boolean).join(", ");
  return {
    company_name: c.name,
    company_tagline: c.tagline,
    company_address: address,
    company_phone: [c.phone, c.mobile].filter(Boolean).join(" / "),
    company_email: c.email,
    company_website: c.website,
    company_gst: c.gstNumber,
  };
}

/**
 * Renders a stored template and sends it. Every attempt is logged to
 * `email_logs` regardless of outcome, so the Email History screen is complete.
 * When MAIL_DRIVER=LOG the message is recorded but not transmitted — this lets
 * the whole workflow be exercised before SMTP credentials exist.
 */
export async function sendTemplatedEmail(input: SendEmailInput) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { code: input.templateCode } });
  const vars = { ...(await companyVariables()), ...(input.variables ?? {}) };

  const subject = renderTemplate(input.override?.subject ?? tpl?.subject ?? input.templateCode, vars);
  const html = renderTemplate(input.override?.bodyHtml ?? tpl?.bodyHtml ?? "<p>{{summary}}</p>", vars);

  const log = await prisma.emailLog.create({
    data: {
      templateCode: input.templateCode,
      toEmail: input.to,
      ccEmail: input.cc ?? null,
      bccEmail: input.bcc ?? null,
      subject,
      bodyPreview: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
      docType: input.docType ?? null,
      recordId: input.recordId ?? null,
      recordNumber: input.recordNumber ?? null,
      customerId: input.customerId ?? null,
      attachments: (input.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length })) as never,
      sentById: input.sentById ?? null,
      status: "QUEUED",
    },
  });

  const transport = getTransport();
  if (!transport) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: "MAIL_DRIVER=LOG — message recorded but not transmitted. Configure SMTP to send for real.",
      },
    });
    console.info(`[email:LOG] to=${input.to} subject="${subject}"`);
    return { id: log.id, delivered: false, simulated: true };
  }

  try {
    const info = await transport.sendMail({
      from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
      to: input.to,
      cc: input.cc || undefined,
      bcc: input.bcc || undefined,
      replyTo: env.mail.replyTo || undefined,
      subject,
      html,
      attachments: input.attachments,
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date(), providerId: info.messageId },
    });
    return { id: log.id, delivered: true, simulated: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
    console.error("[email] send failed", err);
    return { id: log.id, delivered: false, simulated: false, error: "The email could not be sent. Please check the email settings." };
  }
}
