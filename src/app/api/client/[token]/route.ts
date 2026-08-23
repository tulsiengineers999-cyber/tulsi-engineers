import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { resolveClientLink, loadDocument, documentLabel } from "@/lib/services/documents";
import { getCompany } from "@/lib/settings";
import { formatCompanyAddress } from "@/lib/company";
import type { PdfSection } from "@/lib/pdf/layout";

type Ctx = { params: Promise<{ token: string }> };

/** Pulls the photo id back out of the admin-side `/api/files/{id}?...` URL baked into the spec. */
function extractPhotos(sections: PdfSection[]) {
  const out: { id: string; category?: string; description: string }[] = [];
  for (const s of sections) {
    if (!s.photos?.length) continue;
    for (const p of s.photos) {
      const m = p.url.match(/\/api\/files\/([^/?]+)/);
      if (!m) continue;
      out.push({ id: m[1], category: p.category, description: p.caption ?? "" });
    }
  }
  return out;
}

/**
 * Public, token-authenticated read of a client report. Returns only the
 * client-shaped fields needed to render the report — no internal ids,
 * no staff contact details, no audit or cost data, and never the token hash.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const link = await resolveClientLink(token);

    const [doc, company] = await Promise.all([loadDocument(link.docType, link.recordId), getCompany()]);

    const now = new Date();
    await prisma.clientReportLink
      .update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 }, firstViewedAt: link.firstViewedAt ?? now, lastViewedAt: now },
      })
      .catch(() => undefined);

    const confirmation = await prisma.clientConfirmation.findFirst({
      where: { docType: link.docType, recordId: link.recordId, version: link.version },
      select: { status: true, clientName: true, confirmedAt: true, verificationChannel: true, verified: true, correctionRemarks: true },
    });

    return ok({
      docType: doc.docType,
      docLabel: documentLabel(doc.docType),
      documentNumber: doc.number,
      version: doc.version,
      status: doc.status,
      company: {
        name: company.name,
        tagline: company.tagline,
        address: formatCompanyAddress(company),
        phone: company.phone,
        mobile: company.mobile,
        email: company.email,
        website: company.website,
        logoUrl: company.logoUrl || undefined,
      },
      customerName: doc.customerName,
      siteName: doc.siteName,
      jobNumber: doc.jobNumber,
      meta: doc.spec.meta,
      sections: doc.spec.sections,
      photos: extractPhotos(doc.spec.sections),
      confirmation: confirmation
        ? {
            status: confirmation.status,
            clientName: confirmation.status === "CONFIRMED" ? confirmation.clientName : undefined,
            confirmedAt: confirmation.confirmedAt,
            channel: confirmation.verificationChannel,
            verified: confirmation.verified,
            correctionRemarks: confirmation.status === "CORRECTION_REQUESTED" ? confirmation.correctionRemarks : undefined,
          }
        : null,
      allowCorrection: link.allowCorrection,
      recipientName: link.recipientName,
      hasWhatsapp: Boolean(link.recipientMobile),
      hasEmail: Boolean(link.recipientEmail),
    });
  } catch (e) {
    return fail(e);
  }
}
