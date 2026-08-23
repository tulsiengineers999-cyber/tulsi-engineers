import { NextRequest, NextResponse } from "next/server";
import { fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { previewHtml, DOC_PERMISSION } from "@/lib/services/documents";
import type { DocumentType } from "@/generated/prisma";

type Ctx = { params: Promise<{ docType: string; id: string }> };

const SUPPORTED: DocumentType[] = ["MOM", "DAILY_WORK_REPORT", "FINAL_SERVICE_REPORT", "SITE_VISIT_REPORT"];

function resolveDocType(value: string): DocumentType {
  if (!SUPPORTED.includes(value as DocumentType)) {
    throw Errors.notFound("This document type is not supported.");
  }
  return value as DocumentType;
}

/** Serves the printable HTML inline so it opens in a browser tab. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    await requirePermission(`${DOC_PERMISSION[docType]}.view`);

    const html = await previewHtml(docType, id);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return fail(e);
  }
}
