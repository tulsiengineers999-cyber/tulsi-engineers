import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { resolveClientLink, loadDocument } from "@/lib/services/documents";
import { requestOtp } from "@/lib/services/otp";
import type { DocumentType, OtpChannel, OtpPurpose } from "@/generated/prisma";

type Ctx = { params: Promise<{ token: string }> };

const bodySchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL"]).optional(),
});

/** Only these document types have a client-confirmation OTP purpose defined. */
const CONFIRMATION_PURPOSE: Partial<Record<DocumentType, OtpPurpose>> = {
  MOM: "MOM_CONFIRMATION",
  DAILY_WORK_REPORT: "DAILY_REPORT_CONFIRMATION",
  FINAL_SERVICE_REPORT: "FINAL_REPORT_CONFIRMATION",
};

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const link = await resolveClientLink(token);
    const { channel: requested } = bodySchema.parse(await req.json().catch(() => ({})));

    const purpose = CONFIRMATION_PURPOSE[link.docType];
    if (!purpose) {
      throw Errors.validation("Online confirmation is not available for this document type. Please contact TULSI ENGINEERS directly.");
    }

    const alreadyConfirmed = await prisma.clientConfirmation.findFirst({
      where: { docType: link.docType, recordId: link.recordId, version: link.version, status: "CONFIRMED" },
      select: { id: true },
    });
    if (alreadyConfirmed) {
      throw Errors.conflict("This report has already been confirmed by the client.");
    }

    const doc = await loadDocument(link.docType, link.recordId);

    const wantChannel: OtpChannel = requested ?? (link.recipientMobile ? "WHATSAPP" : "EMAIL");
    let channel: OtpChannel = wantChannel;
    let destination = channel === "WHATSAPP" ? link.recipientMobile : link.recipientEmail;
    let switched = false;

    if (!destination) {
      channel = channel === "WHATSAPP" ? "EMAIL" : "WHATSAPP";
      destination = channel === "WHATSAPP" ? link.recipientMobile : link.recipientEmail;
      switched = true;
    }
    if (!destination) {
      throw Errors.validation("No mobile number or email is on file for this contact. Please contact TULSI ENGINEERS directly.");
    }

    const result = await requestOtp({
      purpose,
      channel,
      destination,
      docType: link.docType,
      recordId: link.recordId,
      recordNumber: doc.number,
      linkId: link.id,
      contactName: link.recipientName ?? undefined,
      customerId: link.customerId,
    });

    return ok({
      otpId: result.otpId,
      maskedDestination: result.maskedDestination,
      channel,
      expiresInSeconds: result.expiresInSeconds,
      devCode: result.devCode,
      switched,
      message: switched
        ? `We sent the code by ${channel === "WHATSAPP" ? "WhatsApp" : "email"} instead — no ${wantChannel === "WHATSAPP" ? "WhatsApp number" : "email address"} is on file for this contact.`
        : undefined,
    });
  } catch (e) {
    return fail(e);
  }
}
