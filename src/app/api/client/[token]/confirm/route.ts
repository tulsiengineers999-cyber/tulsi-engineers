import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { ok, fail, Errors } from "@/lib/http";
import { resolveClientLink } from "@/lib/services/documents";
import { recordConfirmation } from "@/lib/services/dispatch";
import { verifyOtp } from "@/lib/services/otp";

type Ctx = { params: Promise<{ token: string }> };

const bodySchema = z.object({
  otpId: z.string().min(1, "Please request a verification code first."),
  code: z.string().min(1, "Please enter the code we sent you."),
  clientName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const link = await resolveClientLink(token);
    const { otpId, code, clientName } = bodySchema.parse(await req.json());

    const verified = await verifyOtp(otpId, code); // friendly AppError on wrong/expired/too-many-attempts

    // Defence in depth: the code must have been issued for this exact link's document.
    if (verified.docType !== link.docType || verified.recordId !== link.recordId) {
      throw Errors.forbidden("This verification code does not belong to this report.");
    }

    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined;
    const userAgent = hdrs.get("user-agent") ?? undefined;

    const confirmation = await recordConfirmation({
      docType: link.docType,
      recordId: link.recordId,
      version: link.version,
      linkId: link.id,
      clientName: clientName ?? link.recipientName ?? undefined,
      clientMobile: link.recipientMobile ?? undefined,
      clientEmail: link.recipientEmail ?? undefined,
      channel: verified.channel,
      ipAddress,
      userAgent,
    });

    return ok({
      status: confirmation.status,
      clientName: confirmation.clientName,
      confirmedAt: confirmation.confirmedAt,
      channel: confirmation.verificationChannel,
      version: confirmation.version,
    });
  } catch (e) {
    return fail(e);
  }
}
