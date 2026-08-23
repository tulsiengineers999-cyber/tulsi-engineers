import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadDocument, DOC_PERMISSION } from "@/lib/services/documents";
import type { DocumentType, Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ docType: string; id: string }> };

const SUPPORTED: DocumentType[] = ["MOM", "DAILY_WORK_REPORT", "FINAL_SERVICE_REPORT", "SITE_VISIT_REPORT"];

function resolveDocType(value: string): DocumentType {
  if (!SUPPORTED.includes(value as DocumentType)) {
    throw Errors.notFound("This document type is not supported.");
  }
  return value as DocumentType;
}

/** Lists the client links issued for this document. The token itself is never exposed. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    await requirePermission(`${DOC_PERMISSION[docType]}.view`);

    const links = await prisma.clientReportLink.findMany({
      where: { docType, recordId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, tokenPrefix: true, version: true, recipientName: true, recipientEmail: true,
        recipientMobile: true, expiresAt: true, revokedAt: true, viewCount: true,
        firstViewedAt: true, lastViewedAt: true, createdAt: true,
      },
    });

    return ok(links);
  } catch (e) {
    return fail(e);
  }
}

/** Withdraws one link (`{ linkId }`) or every live link for this document. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    const user = await requirePermission(`${DOC_PERMISSION[docType]}.edit`);
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const linkId = typeof body.linkId === "string" && body.linkId ? body.linkId : undefined;

    const doc = await loadDocument(docType, id);

    const where: Prisma.ClientReportLinkWhereInput = linkId
      ? { id: linkId, docType, recordId: id, revokedAt: null }
      : { docType, recordId: id, revokedAt: null };

    const { count } = await prisma.clientReportLink.updateMany({ where, data: { revokedAt: new Date() } });
    if (linkId && count === 0) {
      throw Errors.notFound("This link could not be found, or it has already been withdrawn.");
    }

    await audit({
      userId: user.id, userName: user.name, action: "UPDATE", module: docType.toLowerCase(),
      recordId: id, recordLabel: doc.number,
      description: linkId ? "Withdrew one client report link" : `Withdrew ${count} client report link(s)`,
    });

    return ok({ revoked: count });
  } catch (e) {
    return fail(e);
  }
}
