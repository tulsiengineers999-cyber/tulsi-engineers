import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { emailConfigured } from "@/lib/services/email";
import { whatsappConfigured, whatsappConfigurationError } from "@/lib/services/whatsapp";

/** Masks an id/token down to its last 4 characters — never exposes the full value. */
function maskTail(value: string): string {
  if (!value) return "";
  return value.length > 4 ? `••••${value.slice(-4)}` : "••••";
}

export async function GET() {
  try {
    await requirePermission("settings.view");

    const emailReady = await emailConfigured();
    const latestWhatsappFailure = await prisma.whatsappLog.findFirst({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { errorMessage: true, createdAt: true },
    });

    return ok({
      email: {
        driver: env.mail.driver,
        configured: emailReady,
        fromEmail: env.mail.fromEmail,
        host: env.mail.host || "—",
      },
      whatsapp: {
        driver: env.whatsapp.driver,
        provider: env.whatsapp.provider,
        configured: whatsappConfigured(),
        configurationError: whatsappConfigurationError(),
        endpoint: env.whatsapp.wapio.endpoint,
        lastFailure: latestWhatsappFailure?.errorMessage ?? null,
        phoneNumberIdMasked: maskTail(env.whatsapp.phoneNumberId),
        instanceName: env.whatsapp.provider === "WAPIO" ? env.whatsapp.wapio.instanceName : "",
        apiVersion: env.whatsapp.apiVersion,
      },
      storage: {
        driver: env.storage.driver,
        bucket: env.storage.driver === "S3" ? env.storage.s3.bucket : "",
      },
      pdf: {
        driver: env.pdf.driver,
        chromiumAvailable: env.pdf.driver !== "HTML",
      },
      otp: {
        length: env.otp.length,
        ttlMinutes: env.otp.ttlMinutes,
        maxAttempts: env.otp.maxAttempts,
        maxResends: env.otp.maxResends,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
