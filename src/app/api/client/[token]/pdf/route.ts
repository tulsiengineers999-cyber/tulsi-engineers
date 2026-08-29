import { NextRequest, NextResponse } from "next/server";
import { fail, Errors } from "@/lib/http";
import { resolveClientLink, generatePdf } from "@/lib/services/documents";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const link = await resolveClientLink(token);
    const download = req.nextUrl.searchParams.get("download") === "1";

    const { pdf, buffer, fallback } = await generatePdf(link.docType, link.recordId);
    if (fallback) {
      throw Errors.validation("PDF generation returned HTML instead of a PDF.");
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
