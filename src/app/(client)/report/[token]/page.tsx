import clsx from "clsx";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolveClientLink, loadDocument, documentLabel } from "@/lib/services/documents";
import { getCompany } from "@/lib/settings";
import { AppError } from "@/lib/http";
import { Badge, Card } from "@/components/ui/primitives";
import { PhotoGallery } from "@/components/ui/PhotoUploader";
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";
import { formatDateTime } from "@/lib/format";
import { ConfirmPanel } from "./ConfirmPanel";
import type { PdfSection } from "@/lib/pdf/layout";

// Client documents are private, token-gated pages — never indexed.
export const metadata = { robots: { index: false, follow: false } };

type Params = { params: Promise<{ token: string }> };

/** Pulls the photo id back out of the admin-side `/api/files/{id}?...` URL baked into the spec. */
function extractPhotoId(url: string): string | null {
  const m = url.match(/\/api\/files\/([^/?]+)/);
  return m ? m[1] : null;
}

export default async function ClientReportPage({ params }: Params) {
  const { token } = await params;

  let link: Awaited<ReturnType<typeof resolveClientLink>>;
  let doc: Awaited<ReturnType<typeof loadDocument>>;
  let companyName: string;
  try {
    link = await resolveClientLink(token);
    [doc, companyName] = await Promise.all([loadDocument(link.docType, link.recordId), getCompany().then((c) => c.name)]);
  } catch (err) {
    return <LinkProblem error={err} />;
  }

  // Best-effort view tracking — never blocks rendering.
  const now = new Date();
  await prisma.clientReportLink
    .update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, firstViewedAt: link.firstViewedAt ?? now, lastViewedAt: now },
    })
    .catch(() => undefined);

  const confirmation = await prisma.clientConfirmation.findFirst({
    where: { docType: link.docType, recordId: link.recordId, version: link.version },
  });
  const confirmed = confirmation?.status === "CONFIRMED";
  const correctionAlreadyRequested = confirmation?.status === "CORRECTION_REQUESTED";

  return (
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:items-start lg:gap-6">
      <div className="space-y-5 pb-36 lg:pb-0">
        <Card className="print-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{documentLabel(doc.docType)}</p>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">{doc.number}</h1>
              <p className="mt-1 text-base text-slate-700">
                {doc.customerName} &middot; {doc.siteName}
              </p>
              <p className="text-sm text-slate-500">Job {doc.jobNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge tone={DOC_STATUS_TONE[doc.status] ?? "neutral"}>{DOC_STATUS_LABELS[doc.status] ?? doc.status}</Badge>
              <span className="text-xs text-slate-500">Version {doc.version}</span>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {doc.spec.meta.map((m) => (
              <div key={m.label}>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{m.label}</dt>
                <dd className="text-sm font-medium text-slate-800">{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">Issued by {companyName}</p>
        </Card>

        {confirmed && confirmation && (
          <Card className="border-green-200 bg-green-50 print-full">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  This {documentLabel(doc.docType).toLowerCase()} has been confirmed
                </p>
                <p className="mt-1 text-sm text-green-800">
                  Confirmed by <b>{confirmation.clientName ?? "the client"}</b> on {formatDateTime(confirmation.confirmedAt)} — version{" "}
                  {confirmation.version}.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Verified with a one-time code sent by {confirmation.verificationChannel === "EMAIL" ? "email" : "WhatsApp"}.
                </p>
              </div>
            </div>
          </Card>
        )}

        {correctionAlreadyRequested && confirmation && (
          <Card className="border-amber-200 bg-amber-50 print-full">
            <p className="text-sm font-semibold text-amber-900">A correction request is with TULSI ENGINEERS</p>
            {confirmation.correctionRemarks && <p className="mt-1 text-sm whitespace-pre-line text-amber-800">{confirmation.correctionRemarks}</p>}
            <p className="mt-1 text-xs text-amber-700">We&apos;ll follow up with an updated report shortly.</p>
          </Card>
        )}

        {doc.spec.sections.map((section, i) => (
          <DocumentSection key={i} section={section} token={token} />
        ))}
      </div>

      <ConfirmPanel
        token={token}
        documentLabel={documentLabel(doc.docType)}
        confirmed={confirmed}
        allowCorrection={link.allowCorrection}
        correctionAlreadyRequested={correctionAlreadyRequested}
        recipientName={link.recipientName}
        hasWhatsapp={Boolean(link.recipientMobile)}
        hasEmail={Boolean(link.recipientEmail)}
      />
    </div>
  );
}

function DocumentSection({ section, token }: { section: PdfSection; token: string }) {
  const bodyItems = section.body?.filter((b) => b.text) ?? [];
  const hasContent = Boolean(section.fields?.length || bodyItems.length || section.table?.rows.length || section.photos?.length);
  if (!hasContent) return null;

  return (
    <Card title={section.title} className={clsx("print-full", section.pageBreakBefore && "print:break-before-page")}>
      <div className="space-y-5">
        {section.fields && section.fields.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.fields.map((f, i) => (
              <div key={i} className={f.wide ? "sm:col-span-2" : undefined}>
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{f.label}</dt>
                <dd className="mt-0.5 text-base whitespace-pre-line text-slate-800">{f.value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}

        {bodyItems.length > 0 && (
          <div className="space-y-4">
            {bodyItems.map((b, i) => (
              <div key={i}>
                {b.label && <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{b.label}</p>}
                <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-slate-800">{b.text}</p>
              </div>
            ))}
          </div>
        )}

        {section.table && section.table.rows.length > 0 && (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {section.table.columns.map((c, i) => (
                    <th key={i} className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, ri) => (
                  <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-slate-700">
                        {cell ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section.photos && section.photos.length > 0 && (
          <PhotoGallery
            clientToken={token}
            photos={section.photos
              .map((p, i) => {
                const id = extractPhotoId(p.url);
                if (!id) return null;
                return {
                  id,
                  category: p.category ?? "OTHER",
                  fileName: p.caption || `Photo ${i + 1}`,
                  description: p.caption || null,
                  sizeBytes: 0,
                  createdAt: new Date().toISOString(),
                };
              })
              .filter((p): p is NonNullable<typeof p> => p !== null)}
          />
        )}
      </div>
    </Card>
  );
}

function LinkProblem({ error }: { error: unknown }) {
  const message = error instanceof AppError ? error.message : "This report link is not valid.";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-amber-100 p-4">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
      </div>
      <h1 className="text-lg font-bold text-slate-900">We couldn&apos;t open this report</h1>
      <p className="max-w-sm text-base leading-relaxed text-slate-600">{message}</p>
      <p className="max-w-sm text-sm text-slate-500">Please get in touch with TULSI ENGINEERS and we will send you a fresh link.</p>
    </div>
  );
}
