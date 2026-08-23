import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import { PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { FinalReportActions } from "./FinalReportActions";
import { formatDate, formatDateTime } from "@/lib/format";
import { DOC_STATUS_TONE, CONFIRMATION_TONE, CHANNEL_TONE } from "@/lib/ui";
import { DOC_STATUS_LABELS } from "@/lib/masters";

export default async function FinalReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("final_reports.view");
  const { id } = await params;

  const report = await prisma.finalServiceReport.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      site: true,
      job: {
        include: {
          serviceType: true,
          equipment: true,
          moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" }, select: { id: true, momNumber: true, meetingDate: true } },
          visits: { where: { deletedAt: null }, orderBy: { visitDate: "desc" }, select: { id: true, visitNumber: true, visitDate: true } },
          dailyReports: {
            where: { deletedAt: null },
            orderBy: { reportDate: "asc" },
            select: { id: true, reportNumber: true, reportDate: true, workHours: true, progressPercent: true, workPerformed: true },
          },
        },
      },
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  const [confirmations, emailLogs, whatsappLogs] = await Promise.all([
    prisma.clientConfirmation.findMany({ where: { docType: "FINAL_SERVICE_REPORT", recordId: id }, orderBy: { createdAt: "desc" } }),
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
        description={`${report.customer.companyName} · ${report.site.name} · Job ${job.jobNumber}`}
        crumbs={[{ label: "Final Service Reports", href: "/final-reports" }, { label: report.reportNumber }]}
        actions={
          <>
            <Badge tone={DOC_STATUS_TONE[report.status]}>{DOC_STATUS_LABELS[report.status] ?? report.status}</Badge>
            <Badge tone="neutral">v{report.version}</Badge>
            <FinalReportActions
              report={{
                id: report.id,
                jobId: job.id,
                reportNumber: report.reportNumber,
                status: report.status,
                defaultEmail: report.site.email ?? report.customer.email,
                defaultWhatsapp: report.site.whatsapp ?? report.customer.whatsapp ?? report.site.mobile ?? report.customer.mobile,
              }}
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Customer, site & equipment">
            <DetailGrid>
              <DetailRow label="Customer">
                <Link href={`/customers/${report.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">{report.customer.companyName}</Link>
              </DetailRow>
              <DetailRow label="Site">{report.site.name}</DetailRow>
              <DetailRow label="Job">
                <Link href={`/jobs/${job.id}`} className="font-medium text-[var(--te-primary)] hover:underline">{job.jobNumber}</Link>
              </DetailRow>
              <DetailRow label="Equipment">{job.equipment?.name}</DetailRow>
              <DetailRow label="Service type">{job.serviceType.name}</DetailRow>
              <DetailRow label="Work period">
                {report.workStartDate && report.workEndDate ? `${formatDate(report.workStartDate)} to ${formatDate(report.workEndDate)}` : undefined}
              </DetailRow>
              <DetailRow label="Completion date">{formatDate(report.completionDate)}</DetailRow>
              <DetailRow label="Engineer(s)">{report.engineerName}</DetailRow>
              <DetailRow label="Technician(s)">{report.technicianNames}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Work performed">
            <DetailGrid cols={1}>
              <DetailRow label="Scope executed">{report.workPerformed}</DetailRow>
              <DetailRow label="Testing & commissioning">{report.testingDetails}</DetailRow>
              <DetailRow label="Observations">{report.observations}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title={`Day-wise work summary (${job.dailyReports.length})`} bodyClassName={job.dailyReports.length ? "p-0" : undefined}>
            {job.dailyReports.length === 0 ? (
              <EmptyState title="No daily work reports linked to this job" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <th className="px-4 py-2">Report No.</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Hours</th>
                      <th className="px-4 py-2 text-right">Progress</th>
                      <th className="px-4 py-2">Work performed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {job.dailyReports.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2">
                          <Link href={`/daily-reports/${d.id}`} className="font-medium text-[var(--te-primary)] hover:underline">{d.reportNumber}</Link>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{formatDate(d.reportDate)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{d.workHours ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{d.progressPercent}%</td>
                        <td className="px-4 py-2 text-slate-600">{(d.workPerformed ?? "").slice(0, 200)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Materials & spares">
            <DetailGrid>
              <DetailRow label="Materials consumed">{report.materialsSummary}</DetailRow>
              <DetailRow label="Spares replaced">{report.sparesSummary}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Closure">
            <DetailGrid>
              <DetailRow label="Pending work">{report.pendingWork}</DetailRow>
              <DetailRow label="Recommendations">{report.recommendations}</DetailRow>
              <DetailRow label="Final remarks">{report.finalRemarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Photographs">
            <PhotoGallery photos={photos} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Reference documents">
            <div className="space-y-3 text-sm">
              <ReferenceGroup
                label="Site visits"
                items={job.visits.map((v) => ({ id: v.id, label: v.visitNumber, href: `/visits/${v.id}`, sub: formatDate(v.visitDate) }))}
              />
              <ReferenceGroup
                label="MOMs"
                items={job.moms.map((m) => ({ id: m.id, label: m.momNumber, href: `/mom/${m.id}`, sub: formatDate(m.meetingDate) }))}
              />
              <ReferenceGroup
                label="Daily reports"
                items={job.dailyReports.map((d) => ({ id: d.id, label: d.reportNumber, href: `/daily-reports/${d.id}`, sub: formatDate(d.reportDate) }))}
              />
            </div>
          </Card>

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

function ReferenceGroup({ label, items }: { label: string; items: { id: string; label: string; href: string; sub: string }[] }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label} ({items.length})</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">None</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2">
              <Link href={i.href} className="truncate text-xs font-medium text-[var(--te-primary)] hover:underline">{i.label}</Link>
              <span className="shrink-0 text-[11px] text-slate-400">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
