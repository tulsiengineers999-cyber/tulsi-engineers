import { NextRequest } from "next/server";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadDocument, reviseDocument, DOC_PERMISSION } from "@/lib/services/documents";
import type { DocumentType } from "@/generated/prisma";

type Ctx = { params: Promise<{ docType: string; id: string }> };

const SUPPORTED: DocumentType[] = ["MOM", "DAILY_WORK_REPORT", "FINAL_SERVICE_REPORT", "SITE_VISIT_REPORT"];

function resolveDocType(value: string): DocumentType {
  if (!SUPPORTED.includes(value as DocumentType)) {
    throw Errors.notFound("This document type is not supported.");
  }
  return value as DocumentType;
}

/** Bumps the version, clears the confirmation and re-opens a locked document for editing. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    const user = await requirePermission(`${DOC_PERMISSION[docType]}.edit`);

    const before = await loadDocument(docType, id);
    const result = await reviseDocument(docType, id, user.id);

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: docType.toLowerCase(),
      recordId: id, recordLabel: before.number,
      oldValue: { status: before.status, version: before.version },
      newValue: { status: "DRAFT", version: result.version },
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
