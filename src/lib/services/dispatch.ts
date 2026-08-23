import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/http";
import { audit } from "@/lib/audit";
import { sendTemplatedEmail } from "@/lib/services/email";
import { sendWhatsappTemplate } from "@/lib/services/whatsapp";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  createClientLink, generatePdf, loadDocument, documentLabel, summariseForMessage,
} from "@/lib/services/documents";
import type { DocumentType } from "@/generated/prisma";

const EMAIL_TEMPLATE: Record<string, string> = {
  MOM: "MOM_SENT",
  DAILY_WORK_REPORT: "DAILY_REPORT_SENT",
  FINAL_SERVICE_REPORT: "FINAL_REPORT_SENT",
  SITE_VISIT_REPORT: "MOM_SENT",
};

const WHATSAPP_TEMPLATE: Record<string, string> = {
  MOM: "MOM_NOTIFICATION",
  DAILY_WORK_REPORT: "DAILY_REPORT",
  FINAL_SERVICE_REPORT: "FINAL_REPORT",
  SITE_VISIT_REPORT: "CLIENT_CONFIRMATION",
};

export interface SendOptions {
  channels: ("EMAIL" | "WHATSAPP")[];
  attachPdf?: boolean;
  toEmail?: string;
  toWhatsapp?: string;
  cc?: string;
  message?: string;
  allowCorrection?: boolean;
  userId?: string;
  userName?: string;
  /** Resend against the existing link instead of minting a new one. */
  reuseLinkId?: string;
}

/**
 * Generates the PDF, mints (or reuses) a secure client link, sends it over the
 * requested channels and advances the document status to
 * SENT_TO_CLIENT / CONFIRMATION_PENDING.
 */
export async function sendDocumentToClient(docType: DocumentType, id: string, opts: SendOptions) {
  const doc = await loadDocument(docType, id);

  if (doc.status === "DRAFT") {
    throw Errors.conflict(
      `${documentLabel(docType)} ${doc.number} is still a draft. Submit it before sending it to the client.`,
    );
  }
  if (!opts.channels.length) throw Errors.validation("Select at least one channel to send on.");

  const { pdf, buffer, fallback } = await generatePdf(docType, id, opts.userId);

  let linkUrl: string;
  let linkId: string;
  if (opts.reuseLinkId) {
    const existing = await prisma.clientReportLink.findUnique({ where: { id: opts.reuseLinkId } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      const fresh = await createClientLink(docType, id, { createdById: opts.userId, allowCorrection: opts.allowCorrection });
      linkUrl = fresh.url;
      linkId = fresh.link.id;
    } else {
      throw Errors.validation(
        "The original link token cannot be re-read for security reasons. Send again to issue a fresh link.",
      );
    }
  } else {
    const fresh = await createClientLink(docType, id, { createdById: opts.userId, allowCorrection: opts.allowCorrection });
    linkUrl = fresh.url;
    linkId = fresh.link.id;
  }

  const toEmail = (opts.toEmail ?? doc.contactEmail ?? "").trim();
  const toWhatsapp = (opts.toWhatsapp ?? doc.contactWhatsapp ?? doc.contactMobile ?? "").trim();

  const vars = {
    contact_person: doc.contactName ?? "Sir/Madam",
    customer_name: doc.customerName,
    site_name: doc.siteName,
    job_number: doc.jobNumber,
    mom_number: doc.number,
    report_number: doc.number,
    document_number: doc.number,
    document_type: documentLabel(docType),
    meeting_date: formatDate(new Date()),
    report_date: formatDate(new Date()),
    completion_date: formatDate(doc.confirmedAt ?? new Date()),
    equipment_name: "",
    progress: "",
    summary: opts.message ?? summariseForMessage(doc),
    report_link: linkUrl,
  };

  const results: { channel: string; delivered: boolean; simulated?: boolean; error?: string; to: string }[] = [];

  if (opts.channels.includes("EMAIL")) {
    if (!toEmail) {
      results.push({ channel: "EMAIL", delivered: false, to: "", error: "No email address is saved for this customer or site." });
    } else {
      const res = await sendTemplatedEmail({
        templateCode: EMAIL_TEMPLATE[docType],
        to: toEmail,
        cc: opts.cc,
        variables: vars,
        attachments: opts.attachPdf === false ? [] : [{ filename: pdf.fileName, content: buffer, contentType: fallback ? "text/html" : "application/pdf" }],
        docType, recordId: id, recordNumber: doc.number, customerId: doc.customerId,
        sentById: opts.userId,
      });
      results.push({ channel: "EMAIL", delivered: res.delivered, simulated: res.simulated, error: res.error, to: toEmail });
      await audit({
        userId: opts.userId, userName: opts.userName, action: "EMAIL_SENT",
        module: docType.toLowerCase(), recordId: id, recordLabel: doc.number,
        description: `Emailed to ${toEmail}`,
      });
    }
  }

  if (opts.channels.includes("WHATSAPP")) {
    if (!toWhatsapp) {
      results.push({ channel: "WHATSAPP", delivered: false, to: "", error: "No WhatsApp number is saved for this customer or site." });
    } else {
      const res = await sendWhatsappTemplate({
        templateCode: WHATSAPP_TEMPLATE[docType],
        to: toWhatsapp,
        variables: vars,
        docType, recordId: id, recordNumber: doc.number, customerId: doc.customerId,
        sentById: opts.userId,
      });
      results.push({ channel: "WHATSAPP", delivered: res.delivered, simulated: res.simulated, error: res.error, to: toWhatsapp });
      await audit({
        userId: opts.userId, userName: opts.userName, action: "WHATSAPP_SENT",
        module: docType.toLowerCase(), recordId: id, recordLabel: doc.number,
        description: `WhatsApp sent to ${toWhatsapp}`,
      });
    }
  }

  // Already confirmed at this version? Sending again is a courtesy copy —
  // it must not reopen the confirmation or undo the client's sign-off.
  const existingConfirmation = await prisma.clientConfirmation.findFirst({
    where: { docType, recordId: id, version: doc.version },
  });
  const alreadyConfirmed = existingConfirmation?.status === "CONFIRMED";

  if (existingConfirmation) {
    await prisma.clientConfirmation.update({
      where: { id: existingConfirmation.id },
      data: {
        linkId,
        clientName: doc.contactName,
        clientMobile: toWhatsapp || doc.contactMobile,
        clientEmail: toEmail || doc.contactEmail,
      },
    });
  } else {
    await prisma.clientConfirmation.create({
      data: {
        linkId, docType, recordId: id, recordNumber: doc.number, version: doc.version,
        customerId: doc.customerId,
        clientName: doc.contactName, clientMobile: toWhatsapp || doc.contactMobile, clientEmail: toEmail || doc.contactEmail,
        status: "PENDING",
      },
    });
  }

  const patch = alreadyConfirmed
    ? { sentAt: new Date() }
    : { status: "CONFIRMATION_PENDING" as const, sentAt: new Date() };

  if (docType === "MOM") await prisma.mom.update({ where: { id }, data: patch });
  else if (docType === "DAILY_WORK_REPORT") await prisma.dailyWorkReport.update({ where: { id }, data: patch });
  else if (docType === "FINAL_SERVICE_REPORT") await prisma.finalServiceReport.update({ where: { id }, data: patch });
  else if (!alreadyConfirmed) await prisma.siteVisit.update({ where: { id }, data: { status: "SENT_TO_CLIENT" } });

  return { results, linkUrl, linkId, pdfFileName: pdf.fileName, fallback };
}

/**
 * Records an OTP-verified client confirmation and locks the document.
 * The confirmation is bound to the exact version that was viewed.
 */
export async function recordConfirmation(input: {
  docType: DocumentType;
  recordId: string;
  version: number;
  linkId?: string;
  clientName?: string;
  clientMobile?: string;
  clientEmail?: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  ipAddress?: string;
  userAgent?: string;
}) {
  const doc = await loadDocument(input.docType, input.recordId);
  if (doc.version !== input.version) {
    throw Errors.conflict(
      "This report has been revised since the link was issued. Please open the latest link we sent you.",
    );
  }

  const now = new Date();
  const existing = await prisma.clientConfirmation.findFirst({
    where: { docType: input.docType, recordId: input.recordId, version: input.version },
  });

  const confirmation = existing
    ? await prisma.clientConfirmation.update({
        where: { id: existing.id },
        data: {
          status: "CONFIRMED", verified: true, verificationChannel: input.channel,
          confirmedAt: now, clientName: input.clientName ?? existing.clientName,
          clientMobile: input.clientMobile ?? existing.clientMobile,
          ipAddress: input.ipAddress, userAgent: input.userAgent, linkId: input.linkId ?? existing.linkId,
        },
      })
    : await prisma.clientConfirmation.create({
        data: {
          linkId: input.linkId, docType: input.docType, recordId: input.recordId,
          recordNumber: doc.number, version: input.version, customerId: doc.customerId,
          clientName: input.clientName, clientMobile: input.clientMobile, clientEmail: input.clientEmail,
          status: "CONFIRMED", verified: true, verificationChannel: input.channel,
          confirmedAt: now, ipAddress: input.ipAddress, userAgent: input.userAgent,
        },
      });

  const patch = { status: "CLIENT_CONFIRMED" as const, confirmedAt: now, lockedAt: now };
  if (input.docType === "MOM") await prisma.mom.update({ where: { id: input.recordId }, data: patch });
  else if (input.docType === "DAILY_WORK_REPORT") await prisma.dailyWorkReport.update({ where: { id: input.recordId }, data: patch });
  else if (input.docType === "FINAL_SERVICE_REPORT") await prisma.finalServiceReport.update({ where: { id: input.recordId }, data: patch });
  else await prisma.siteVisit.update({ where: { id: input.recordId }, data: { status: "CLIENT_CONFIRMED" } });

  await audit({
    action: "CLIENT_CONFIRMED", module: input.docType.toLowerCase(),
    recordId: input.recordId, recordLabel: doc.number,
    description: `Confirmed by ${input.clientName ?? "client"} via ${input.channel} OTP`,
  });

  await notifyInternal(input.docType, input.recordId, doc.number, doc.customerName, now);
  await sendAcknowledgement(input.docType, doc, now);

  return confirmation;
}

export async function recordCorrectionRequest(input: {
  docType: DocumentType;
  recordId: string;
  version: number;
  linkId?: string;
  remarks: string;
  clientName?: string;
}) {
  const doc = await loadDocument(input.docType, input.recordId);
  const existing = await prisma.clientConfirmation.findFirst({
    where: { docType: input.docType, recordId: input.recordId, version: input.version },
  });

  if (existing) {
    await prisma.clientConfirmation.update({
      where: { id: existing.id },
      data: { status: "CORRECTION_REQUESTED", correctionRemarks: input.remarks, clientName: input.clientName ?? existing.clientName },
    });
  } else {
    await prisma.clientConfirmation.create({
      data: {
        linkId: input.linkId, docType: input.docType, recordId: input.recordId,
        recordNumber: doc.number, version: input.version, customerId: doc.customerId,
        status: "CORRECTION_REQUESTED", correctionRemarks: input.remarks, clientName: input.clientName,
      },
    });
  }

  const patch = { status: "CORRECTION_REQUESTED" as const };
  if (input.docType === "MOM") await prisma.mom.update({ where: { id: input.recordId }, data: patch });
  else if (input.docType === "DAILY_WORK_REPORT") await prisma.dailyWorkReport.update({ where: { id: input.recordId }, data: patch });
  else if (input.docType === "FINAL_SERVICE_REPORT") await prisma.finalServiceReport.update({ where: { id: input.recordId }, data: patch });

  await audit({
    action: "CORRECTION_REQUESTED", module: input.docType.toLowerCase(),
    recordId: input.recordId, recordLabel: doc.number,
    description: input.remarks.slice(0, 300),
  });

  await notifyInternal(
    input.docType, input.recordId, doc.number, doc.customerName, new Date(),
    "CONFIRMATION_PENDING", "Correction requested by client",
  );

  return { ok: true };
}

async function notifyInternal(
  docType: DocumentType,
  recordId: string,
  number: string,
  customerName: string,
  at: Date,
  type: "REPORT_CONFIRMED" | "CONFIRMATION_PENDING" = "REPORT_CONFIRMED",
  title = "Client confirmation received",
) {
  const recipients = await prisma.user.findMany({
    where: {
      deletedAt: null, status: "ACTIVE",
      role: { code: { in: ["SUPER_ADMIN", "ADMIN", "SERVICE_MANAGER"] } },
    },
    select: { id: true },
  });
  if (!recipients.length) return;

  const route: Record<string, string> = {
    MOM: "/mom", DAILY_WORK_REPORT: "/daily-reports",
    FINAL_SERVICE_REPORT: "/final-reports", SITE_VISIT_REPORT: "/visits",
  };

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type,
      title,
      message: `${documentLabel(docType)} ${number} — ${customerName} (${formatDateTime(at)})`,
      link: `${route[docType]}/${recordId}`,
      recordId,
    })),
  });
}

async function sendAcknowledgement(
  docType: DocumentType,
  doc: Awaited<ReturnType<typeof loadDocument>>,
  at: Date,
) {
  const vars = {
    contact_person: doc.contactName ?? "Sir/Madam",
    customer_name: doc.customerName,
    document_type: documentLabel(docType),
    document_number: doc.number,
    mom_number: doc.number,
    report_number: doc.number,
    confirmed_at: formatDateTime(at),
  };

  if (doc.contactEmail) {
    await sendTemplatedEmail({
      templateCode: "REPORT_CONFIRMED", to: doc.contactEmail, variables: vars,
      docType, recordId: doc.id, recordNumber: doc.number, customerId: doc.customerId,
    }).catch(() => undefined);
  }
  const wa = doc.contactWhatsapp ?? doc.contactMobile;
  if (wa && docType === "MOM") {
    await sendWhatsappTemplate({
      templateCode: "MOM_CONFIRMATION", to: wa, variables: vars,
      docType, recordId: doc.id, recordNumber: doc.number, customerId: doc.customerId,
    }).catch(() => undefined);
  } else if (wa && docType === "DAILY_WORK_REPORT") {
    await sendWhatsappTemplate({
      templateCode: "DAILY_REPORT_CONFIRMATION", to: wa, variables: vars,
      docType, recordId: doc.id, recordNumber: doc.number, customerId: doc.customerId,
    }).catch(() => undefined);
  }
}
