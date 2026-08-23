import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, Errors } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { getFile } from "@/lib/storage";
import { resolveClientLink } from "@/lib/services/documents";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Confirms a photo or document actually belongs to the customer whose report
 * link was presented. Photos hang off jobs, visits, MOMs and reports rather
 * than off the customer directly, so ownership is resolved through those.
 */
async function fileBelongsToCustomer(kind: string, id: string, customerId: string): Promise<boolean> {
  const owned = { customerId };

  if (kind === "document") {
    const doc = await prisma.document.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          owned,
          { job: owned },
          { site: owned },
          { equipment: owned },
          { siteVisit: owned },
          { mom: owned },
          { dailyReport: { job: owned } },
          { finalReport: owned },
        ],
      },
      select: { id: true },
    });
    return Boolean(doc);
  }

  if (kind === "pdf") {
    const pdf = await prisma.pdfDocument.findUnique({ where: { id }, select: { docType: true, recordId: true } });
    if (!pdf) return false;
    const where = { id: pdf.recordId, ...owned };
    if (pdf.docType === "MOM") return Boolean(await prisma.mom.findFirst({ where, select: { id: true } }));
    if (pdf.docType === "FINAL_SERVICE_REPORT")
      return Boolean(await prisma.finalServiceReport.findFirst({ where, select: { id: true } }));
    if (pdf.docType === "SITE_VISIT_REPORT")
      return Boolean(await prisma.siteVisit.findFirst({ where, select: { id: true } }));
    return Boolean(
      await prisma.dailyWorkReport.findFirst({ where: { id: pdf.recordId, job: owned }, select: { id: true } }),
    );
  }

  const photo = await prisma.photo.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        { job: owned },
        { siteVisit: owned },
        { mom: owned },
        { equipment: owned },
        { dailyReport: { job: owned } },
        { finalReport: owned },
      ],
    },
    select: { id: true },
  });
  return Boolean(photo);
}

/**
 * Authorised file delivery. Files never live under /public — every read passes
 * through here so we can check either a signed-in session or a valid client
 * report token.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("type") ?? "photo";
    const clientToken = sp.get("t");

    let authorised = false;
    if (clientToken) {
      // A report token grants access only to files attached to that customer's
      // records — never to any file id a visitor cares to guess.
      const link = await resolveClientLink(clientToken); // throws when invalid/expired
      authorised = await fileBelongsToCustomer(kind, id, link.customerId);
      if (!authorised) throw Errors.notFound("This file is not part of the report you opened.");
    } else {
      authorised = Boolean(await getCurrentUser());
    }
    if (!authorised) throw Errors.unauthorized();

    let storageKey: string;
    let mimeType: string;
    let fileName: string;

    if (kind === "document") {
      const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
      if (!doc) throw Errors.notFound("This file could not be found.");
      ({ storageKey, mimeType, fileName } = doc);
    } else if (kind === "pdf") {
      const pdf = await prisma.pdfDocument.findUnique({ where: { id } });
      if (!pdf) throw Errors.notFound("This document could not be found.");
      storageKey = pdf.storageKey;
      fileName = pdf.fileName;
      mimeType = pdf.fileName.endsWith(".html") ? "text/html" : "application/pdf";
    } else {
      const photo = await prisma.photo.findFirst({ where: { id, deletedAt: null } });
      if (!photo) throw Errors.notFound("This photo could not be found.");
      ({ storageKey, mimeType, fileName } = photo);
    }

    const buffer = await getFile(storageKey);
    const inline = sp.get("inline") === "1" || mimeType.startsWith("image/");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
