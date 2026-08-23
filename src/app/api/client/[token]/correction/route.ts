import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, Errors } from "@/lib/http";
import { resolveClientLink } from "@/lib/services/documents";
import { recordCorrectionRequest } from "@/lib/services/dispatch";

type Ctx = { params: Promise<{ token: string }> };

const bodySchema = z.object({
  remarks: z.string().trim().min(5, "Please describe the correction needed (at least 5 characters)."),
  clientName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const link = await resolveClientLink(token);
    if (!link.allowCorrection) {
      throw Errors.forbidden("Correction requests are not enabled for this report. Please contact TULSI ENGINEERS directly.");
    }

    const { remarks, clientName } = bodySchema.parse(await req.json());

    await recordCorrectionRequest({
      docType: link.docType,
      recordId: link.recordId,
      version: link.version,
      linkId: link.id,
      remarks,
      clientName: clientName ?? link.recipientName ?? undefined,
    });

    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
