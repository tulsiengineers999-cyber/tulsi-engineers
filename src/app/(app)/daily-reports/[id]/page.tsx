import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import type { GalleryPhoto } from "@/components/ui/PhotoUploader";
import { DailyReportActions } from "./DailyReportActions";
import { PhotoPanel } from "./PhotoPanel";
import { formatDate, formatDateTime } from "@/lib/format";
import { DOC_STATUS_TONE, CONFIRMATION_TONE, CHANNEL_TONE } from "@/lib/ui";
import { DOC_STATUS_LABELS } from "@/lib/masters";

export default async function DailyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("daily_reports.view");
  const { id } = await params;

  const report = await prisma.dailyWorkReport.findFirst({
    where: { id, deletedAt: null },
    include: {
      job: { include: { customer: true, site: true, serviceType: true, equipment: true } },
      engineer: { select: { id: true, name: true, mobile: true, email: true, designation: true } },
      materials: { orderBy: { createdAt: "asc" } },
      spares: { orderBy: { createdAt: "asc" } },
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  const [confirmations, emailLogs, whatsappLogs] = await Promise.all([
    prisma.clientConfirmation.findMany({ where: { docType: "DAILY_WORK_REPORT", recordId: id }, orderBy: { createdAt: "desc" } }),
    prisma.emailLog.findMany({ where: { recordId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.whatsappLog.findMany({ where: { recordId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const photos: GalleryPhoto[] = report.photos.map((p) => ({
    id: p.id,
    category: p.category,
    fileName: p.fileName,
    description: p.description,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy,
  }));

  const { job } = report;

  return (
    <>
      <PageHeader
        title={report.reportNumber}
        description={`${job.customer.companyName} · ${job.site.name} · Job ${job.jobNumber}`}
        crumbs={[{ label: "Daily Work Reports", href: "/daily-reports" }, { label: report.reportNumber }]}
        actions={
          <>
            <Badge tone={DOC_STATUS_TONE[report.status]}>{DOC_STATUS_LABELS[report.status] ?? report.status}</Badge>
            <Badge tone="neutral">v{report.version}</Badge>
            <DailyReportActions
              report={{
                id: report.id,
                reportNumber: report.reportNumber,
                status: report.status,
                defaultEmail: job.site.email ?? job.customer.email,
                defaultWhatsapp: job.site.whatsapp ?? job.customer.whatsapp ?? job.site.mobile ?? job.customer.mobile,
              }}
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Report details">
            <DetailGrid>
              <DetailRow label="Job">
                <Link href={`/jobs/${job.id}`} className="font-medium text-[var(--te-primary)] hover:underline">{job.jobNumber}</Link>
              </DetailRow>
              <DetailRow label="Customer">
                <Link href={`/customers/${job.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">{job.customer.companyName}</Link>
              </DetailRow>
              <DetailRow label="Site">{job.site.name}</DetailRow>
              <DetailRow label="Equipment">{job.equipment?.name}</DetailRow>
              <DetailRow label="Service type">{job.serviceType.name}</DetailRow>
              <DetailRow label="Report date">{formatDate(report.reportDate)}</DetailRow>
              <DetailRow label="Engineer">{report.engineer?.name}</DetailRow>
              <DetailRow label="Technician(s)">{report.technicianNames}</DetailRow>
              <DetailRow label="Start time">{report.startTime}</DetailRow>
              <DetailRow label="End time">{report.endTime}</DetailRow>
              <DetailRow label="Work hours">{report.workHours != null ? `${report.workHours} hrs` : undefined}</DetailRow>
              <DetailRow label="Progress">{`${report.progressPercent}%`}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Work carried out">
            <DetailGrid cols={1}>
              <DetailRow label="Work performed">{report.workPerformed}</DetailRow>
              <DetailRow label="Tools used">{report.toolsUsed}</DetailRow>
              <DetailRow label="Technical findings">{report.technicalFindings}</DetailRow>
              <DetailRow label="Problems encountered">{report.problems}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title={`Materials used (${report.materials.length})`} bodyClassName={report.materials.length ? "p-0" : undefined}>
            {report.materials.length === 0 ? (
              <EmptyState title="No materials recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <th className="px-4 py-2">Material</th>
                      <th className="px-4 py-2">Specification</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2">Unit</th>
                      <th className="px-4 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.materials.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 font-medium text-slate-800">{m.name}</td>
                        <td className="px-4 py-2 text-slate-600">{m.specification ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{m.quantity}</td>
                        <td className="px-4 py-2 text-slate-600">{m.unit ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{m.remarks ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Spares used (${report.spares.length})`} bodyClassName={report.spares.length ? "p-0" : undefined}>
            {report.spares.length === 0 ? (
              <EmptyState title="No spares recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <th className="px-4 py-2">Spare</th>
                      <th className="px-4 py-2">Part no.</th>
                      <th className="px-4 py-2">Make</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2">Unit</th>
                      <th className="px-4 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.spares.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                        <td className="px-4 py-2 text-slate-600">{s.partNumber ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{s.make ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{s.quantity}</td>
                        <td className="px-4 py-2 text-slate-600">{s.unit ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{s.remarks ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Status & next steps">
            <DetailGrid>
              <DetailRow label="Pending work">{report.pendingWork}</DetailRow>
              <DetailRow label="Next action">{report.nextAction}</DetailRow>
              <DetailRow label="Recommendations">{report.recommendations}</DetailRow>
              <DetailRow label="Remarks">{report.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <PhotoPanel dailyReportId={report.id} jobId={job.id} photos={photos} />
        </div>

        <div className="space-y-5">
          <Card title="Client confirmation">
            {confirmations.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Not yet sent to client" description="Send this report to the client to collect their confirmation." />
            ) : (
              <ul className="space-y-3">
                {confirmations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={CONFIRMATION_TONE[c.status]}>{c.status.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-slate-400">v{c.version}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">{c.clientName ?? "—"}</p>
                    {c.confirmedAt && (
                      <p className="text-xs text-slate-500">Confirmed {formatDateTime(c.confirmedAt)} via {c.verificationChannel ?? "—"}</p>
                    )}
                    {c.correctionRemarks && <p className="mt-1 text-xs text-red-600">“{c.correctionRemarks}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Communication history">
            {emailLogs.length === 0 && whatsappLogs.length === 0 ? (
              <EmptyState title="Nothing sent yet" />
            ) : (
              <ul className="space-y-3 text-sm">
                {emailLogs.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-700">{l.toEmail}</span>
                        <Badge tone={CHANNEL_TONE[l.status]}>{l.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{formatDateTime(l.sentAt ?? l.createdAt)}</p>
                    </div>
                  </li>
                ))}
                {whatsappLogs.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-700">{l.toNumber}</span>
                        <Badge tone={CHANNEL_TONE[l.status]}>{l.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{formatDateTime(l.sentAt ?? l.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
