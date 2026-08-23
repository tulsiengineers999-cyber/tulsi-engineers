import { NextRequest } from "next/server";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { sendSchema } from "@/lib/validation/operations";
import { sendDocumentToClient } from "@/lib/services/dispatch";
import { DOC_PERMISSION } from "@/lib/services/documents";
import type { DocumentType } from "@/generated/prisma";

// Rendering a report with photographs through headless Chromium takes longer
// than a plain query. Serverless hosts terminate anything past this.
export const maxDuration = 120;

type Ctx = { params: Promise<{ docType: string; id: string }> };

const SUPPORTED: DocumentType[] = ["MOM", "DAILY_WORK_REPORT", "FINAL_SERVICE_REPORT", "SITE_VISIT_REPORT"];

function resolveDocType(value: string): DocumentType {
  if (!SUPPORTED.includes(value as DocumentType)) {
    throw Errors.notFound("This document type is not supported.");
  }
  return value as DocumentType;
}

/** Emails and/or WhatsApps the document to the client with a secure link. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    const user = await requirePermission(`${DOC_PERMISSION[docType]}.email`, `${DOC_PERMISSION[docType]}.whatsapp`);
    const data = sendSchema.parse(await req.json());

    const result = await sendDocumentToClient(docType, id, { ...data, userId: user.id, userName: user.name });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
