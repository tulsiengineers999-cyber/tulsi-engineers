import { NextRequest, NextResponse } from "next/server";
import { fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { generatePdf, DOC_PERMISSION } from "@/lib/services/documents";
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

/**
 * Generates (or reuses the cached) PDF and streams it to the browser.
 * When Chromium is unavailable the shared PDF engine falls back to printable
 * HTML — that fallback is served honestly as HTML, never mislabelled.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { docType: docTypeParam, id } = await params;
    const docType = resolveDocType(docTypeParam);
    const user = await requirePermission(`${DOC_PERMISSION[docType]}.pdf`);
    const inline = req.nextUrl.searchParams.get("inline") === "1";

    const { pdf, buffer, fallback } = await generatePdf(docType, id, user.id);

    await audit({
      userId: user.id, userName: user.name, action: "PDF_GENERATED", module: docType.toLowerCase(),
      recordId: id, recordLabel: pdf.recordNumber,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": fallback ? "text/html; charset=utf-8" : "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdf.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
