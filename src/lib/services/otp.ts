import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AppError, Errors } from "@/lib/http";
import { sendWhatsappTemplate } from "@/lib/services/whatsapp";
import { sendTemplatedEmail } from "@/lib/services/email";
import { audit } from "@/lib/audit";
import type { DocumentType, OtpChannel, OtpPurpose } from "@/generated/prisma";

/** OTP codes are stored only as a peppered SHA-256 digest. Plain values never persist. */
function hashCode(code: string, destination: string): string {
  return crypto
    .createHmac("sha256", env.otp.pepper)
    .update(`${destination}:${code}`)
    .digest("hex");
}

function generateCode(): string {
  const max = 10 ** env.otp.length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(env.otp.length, "0");
}

export function maskDestination(value: string, channel: OtpChannel): string {
  if (channel === "EMAIL") {
    const [user, domain] = value.split("@");
    if (!domain) return "•••";
    return `${user.slice(0, 2)}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length > 4 ? `${"•".repeat(digits.length - 4)}${digits.slice(-4)}` : "••••";
}

/** How many OTPs may be requested from one destination inside the window. */
const RATE_WINDOW_MINUTES = 15;
const RATE_MAX_PER_WINDOW = 5;

export interface RequestOtpInput {
  purpose: OtpPurpose;
  channel: OtpChannel;
  destination: string;
  docType?: DocumentType;
  recordId?: string;
  recordNumber?: string;
  linkId?: string;
  contactName?: string;
  customerId?: string;
  ipAddress?: string;
}

export async function requestOtp(input: RequestOtpInput) {
  if (!input.destination) {
    throw Errors.validation(
      input.channel === "EMAIL"
        ? "No email address is registered for this contact."
        : "No mobile number is registered for this contact.",
    );
  }

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await prisma.otpVerification.count({
    where: { destination: input.destination, createdAt: { gte: since } },
  });
  if (recent >= RATE_MAX_PER_WINDOW) {
    throw Errors.tooMany(
      `Too many verification codes requested. Please wait ${RATE_WINDOW_MINUTES} minutes and try again.`,
    );
  }

  // Retire any live code for the same target so only one is ever valid.
  await prisma.otpVerification.updateMany({
    where: {
      purpose: input.purpose,
      recordId: input.recordId ?? undefined,
      destination: input.destination,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  const row = await prisma.otpVerification.create({
    data: {
      purpose: input.purpose,
      channel: input.channel,
      destination: input.destination,
      codeHash: hashCode(code, input.destination),
      docType: input.docType ?? null,
      recordId: input.recordId ?? null,
      linkId: input.linkId ?? null,
      maxAttempts: env.otp.maxAttempts,
      expiresAt: new Date(Date.now() + env.otp.ttlMinutes * 60_000),
      ipAddress: input.ipAddress ?? null,
    },
  });

  if (input.channel === "EMAIL") {
    const delivery = await sendTemplatedEmail({
      templateCode: "OTP_CODE",
      to: input.destination,
      variables: {
        contact_person: input.contactName ?? "Sir/Madam",
        otp_code: code,
        document_number: input.recordNumber ?? "",
        expiry_minutes: env.otp.ttlMinutes,
      },
      docType: input.docType,
      recordId: input.recordId,
      recordNumber: input.recordNumber,
      customerId: input.customerId,
    });

    if (!delivery.delivered && !delivery.simulated) {
      throw Errors.validation(delivery.error ?? "The email verification code could not be sent. Please try again.");
    }
  } else {
    const delivery = await sendWhatsappTemplate({
      templateCode: "OTP",
      to: input.destination,
      bodyParams: [code, String(env.otp.ttlMinutes)],
      docType: input.docType,
      recordId: input.recordId,
      recordNumber: input.recordNumber,
      customerId: input.customerId,
    });

    if (!delivery.delivered && !delivery.simulated) {
      throw Errors.validation(delivery.error ?? "The WhatsApp verification code could not be sent. Please try again.");
    }
  }

  await audit({
    action: "OTP_SENT",
    module: "otp",
    recordId: input.recordId,
    recordLabel: input.recordNumber,
    description: `OTP sent via ${input.channel} to ${maskDestination(input.destination, input.channel)}`,
  });

  return {
    otpId: row.id,
    maskedDestination: maskDestination(input.destination, input.channel),
    expiresAt: row.expiresAt,
    expiresInSeconds: env.otp.ttlMinutes * 60,
    // Development convenience only — never exposed once NODE_ENV=production.
    devCode: env.isProd ? undefined : code,
  };
}

export async function resendOtp(otpId: string, contactName?: string) {
  const existing = await prisma.otpVerification.findUnique({ where: { id: otpId } });
  if (!existing) throw Errors.notFound("Verification session not found. Please start again.");
  if (existing.resendCount >= env.otp.maxResends) {
    throw Errors.tooMany(`You have reached the maximum of ${env.otp.maxResends} resend attempts.`);
  }

  const result = await requestOtp({
    purpose: existing.purpose,
    channel: existing.channel,
    destination: existing.destination,
    docType: existing.docType ?? undefined,
    recordId: existing.recordId ?? undefined,
    linkId: existing.linkId ?? undefined,
    contactName,
  });

  await prisma.otpVerification.update({
    where: { id: result.otpId },
    data: { resendCount: existing.resendCount + 1 },
  });

  return { ...result, resendsRemaining: env.otp.maxResends - existing.resendCount - 1 };
}

export async function verifyOtp(otpId: string, code: string) {
  const row = await prisma.otpVerification.findUnique({ where: { id: otpId } });
  if (!row) throw Errors.notFound("Verification session not found. Please request a new code.");
  if (row.consumedAt) throw new AppError("This code has already been used.", 410, "OTP_CONSUMED");
  if (row.expiresAt < new Date()) {
    await audit({ action: "OTP_FAILED", module: "otp", recordId: row.recordId, description: "OTP expired" });
    throw new AppError("This code has expired. Please request a new one.", 410, "OTP_EXPIRED");
  }
  if (row.attempts >= row.maxAttempts) {
    throw Errors.tooMany("Too many incorrect attempts. Please request a new code.");
  }

  const supplied = (code ?? "").replace(/\D/g, "");
  const expected = row.codeHash;
  const actual = hashCode(supplied, row.destination);
  const matches =
    supplied.length === env.otp.length &&
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));

  if (!matches) {
    const attempts = row.attempts + 1;
    await prisma.otpVerification.update({ where: { id: row.id }, data: { attempts } });
    await audit({
      action: "OTP_FAILED",
      module: "otp",
      recordId: row.recordId,
      description: `Incorrect OTP (attempt ${attempts}/${row.maxAttempts})`,
    });
    const left = row.maxAttempts - attempts;
    throw Errors.validation(
      left > 0
        ? `Incorrect code. ${left} attempt(s) remaining.`
        : "Incorrect code. You have no attempts left — please request a new code.",
    );
  }

  const verified = await prisma.otpVerification.update({
    where: { id: row.id },
    data: { verifiedAt: new Date(), consumedAt: new Date() },
  });

  await audit({
    action: "OTP_VERIFIED",
    module: "otp",
    recordId: row.recordId,
    description: `OTP verified via ${row.channel}`,
  });

  return verified;
}
