import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileText, Camera } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { JobActions } from "./JobActions";
import { formatDate } from "@/lib/format";
import { JOB_STATUS_TONE, PRIORITY_TONE, DOC_STATUS_TONE } from "@/lib/ui";
import { JOB_STATUS_LABELS, PRIORITY_LABELS, DOC_STATUS_LABELS } from "@/lib/masters";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("jobs.view");
  const { id } = await params;

  const job = await prisma.serviceJob.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, companyName: true, mobile: true, email: true } },
      site: { select: { id: true, name: true, address: true, city: true, state: true } },
      equipment: { select: { id: true, name: true, serialNumber: true } },
      serviceType: { select: { id: true, name: true, category: true } },
      engineer: { select: { id: true, name: true, mobile: true, email: true } },
      technician: { select: { id: true, name: true, mobile: true, email: true } },
      assignments: { orderBy: { assignedAt: "desc" }, include: { user: { select: { id: true, name: true } } } },
      visits: { where: { deletedAt: null }, orderBy: { visitDate: "desc" } },
      moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" } },
      dailyReports: { where: { deletedAt: null }, orderBy: { reportDate: "desc" } },
      finalReports: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) notFound();

  const changedByIds = [...new Set(job.statusHistory.map((h) => h.changedById).filter(Boolean))] as string[];

  const [photosRaw, changedByUsers, staff] = await Promise.all([
    prisma.photo.findMany({
      where: { jobId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    changedByIds.length
      ? prisma.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE", OR: [{ isEngineer: true }, { isTechnician: true }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isEngineer: true, isTechnician: true },
    }),
  ]);

  const changedByMap = Object.fromEntries(changedByUsers.map((u) => [u.id, u.name]));
  const photos: GalleryPhoto[] = photosRaw.map((p) => ({
    id: p.id,
    category: p.category,
    fileName: p.fileName,
    description: p.description,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy,
  }));

  const timeline: TimelineEntry[] = job.statusHistory.map((h) => ({
    id: h.id,
    title: JOB_STATUS_LABELS[h.toStatus],
    description: [h.changedById ? `by ${changedByMap[h.changedById] ?? "—"}` : null, h.remarks].filter(Boolean).join(" — ") || undefined,
    at: h.createdAt,
    tone: h.toStatus === "CANCELLED" ? "danger" : h.toStatus === "COMPLETED" || h.toStatus === "CLOSED" ? "success" : "primary",
  }));

  const permissions = {
    canEdit: can(user.permissions, "jobs.edit"),
    canAssign: can(user.permissions, "jobs.assign"),
    canDelete: can(user.permissions, "jobs.delete"),
    canCreateVisit: can(user.permissions, "visits.create"),
    canCreateMom: can(user.permissions, "mom.create"),
    canCreateDaily: can(user.permissions, "daily_reports.create"),
    canCreateFinal: can(user.permissions, "final_reports.create"),
  };

  return (
    <>
      <PageHeader
        title={job.jobNumber}
        description={`${job.customer.companyName} · ${job.site.name} · ${job.serviceType.name}`}
        crumbs={[{ label: "Service Jobs", href: "/jobs" }, { label: job.jobNumber }]}
        actions={
          <>
            <Badge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABELS[job.priority]}</Badge>
            <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Job details">
            <DetailGrid>
              <DetailRow label="Customer">
                <Link href={`/customers/${job.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {job.customer.companyName}
                </Link>
              </DetailRow>
              <DetailRow label="Site">
                <Link href={`/sites/${job.site.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {job.site.name}
                </Link>
              </DetailRow>
              <DetailRow label="Equipment">
                {job.equipment ? (
                  <Link href={`/equipment/${job.equipment.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                    {job.equipment.name}{job.equipment.serialNumber ? ` (Sr. ${job.equipment.serialNumber})` : ""}
                  </Link>
                ) : undefined}
              </DetailRow>
              <DetailRow label="Service type">{job.serviceType.name}</DetailRow>
              <DetailRow label="Request date">{formatDate(job.requestDate)}</DetailRow>
              <DetailRow label="Planned visit date">{formatDate(job.plannedVisitDate)}</DetailRow>
              <DetailRow label="Target completion date">{formatDate(job.targetCompletionDate)}</DetailRow>
              <DetailRow label="Completed on">{formatDate(job.completedAt)}</DetailRow>
              <DetailRow label="Progress">{job.progressPercent}%</DetailRow>
              <DetailRow label="Customer's requirement" className="sm:col-span-2">{job.customerRequirement}</DetailRow>
              <DetailRow label="Problem description" className="sm:col-span-2">{job.problemDescription}</DetailRow>
              <DetailRow label="Job description" className="sm:col-span-2">{job.jobDescription}</DetailRow>
              <DetailRow label="Material required">{job.requiredMaterial}</DetailRow>
              <DetailRow label="Spares required">{job.requiredSpare}</DetailRow>
              <DetailRow label="Remarks" className="sm:col-span-2">{job.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Assignment">
            <DetailGrid>
              <DetailRow label="Engineer">{job.engineer?.name}</DetailRow>
              <DetailRow label="Technician">{job.technician?.name}</DetailRow>
            </DetailGrid>
            {job.assignments.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Assignment history</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {job.assignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium text-slate-800">{a.user.name}</span> · {a.role === "ENGINEER" ? "Engineer" : "Technician"}
                      </span>
                      <span className="text-slate-400">
                        {formatDate(a.assignedAt)}{a.unassignedAt ? ` – ${formatDate(a.unassignedAt)}` : " – present"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <RecordListCard
            title="Site visits"
            icon={ClipboardList}
            items={job.visits.map((v) => ({
              id: v.id, label: v.visitNumber, href: `/visits/${v.id}`,
              sub: formatDate(v.visitDate), status: v.status,
            }))}
          />
          <RecordListCard
            title="MOMs"
            icon={FileText}
            items={job.moms.map((m) => ({
              id: m.id, label: m.momNumber, href: `/mom/${m.id}`,
              sub: formatDate(m.meetingDate), status: m.status,
            }))}
          />
          <RecordListCard
            title="Daily work reports"
            icon={FileText}
            items={job.dailyReports.map((d) => ({
              id: d.id, label: d.reportNumber, href: `/daily-reports/${d.id}`,
              sub: formatDate(d.reportDate), status: d.status,
            }))}
          />
          <RecordListCard
            title="Final service report"
            icon={FileText}
            items={job.finalReports.map((f) => ({
              id: f.id, label: f.reportNumber, href: `/final-reports/${f.id}`,
              sub: formatDate(f.completionDate), status: f.status,
            }))}
          />

          <Card title={`Photos (${photos.length})`}>
            {photos.length === 0 ? (
              <EmptyState icon={Camera} title="No photos uploaded yet" description="Photos uploaded during site visits and reports appear here." />
            ) : (
              <PhotoGallery photos={photos} />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Quick actions">
            <JobActions
              job={JSON.parse(JSON.stringify(job))}
              staff={staff}
              permissions={permissions}
            />
          </Card>

          <Card title="Status history">
            <Timeline entries={timeline} />
          </Card>
        </div>
      </div>
    </>
  );
}

function RecordListCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: { id: string; label: string; href: string; sub: string; status: string }[];
}) {
  return (
    <Card title={`${title} (${items.length})`} bodyClassName={items.length ? "p-0" : undefined}>
      {items.length === 0 ? (
        <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{i.label}</span>
                  <span className="block truncate text-xs text-slate-500">{i.sub}</span>
                </span>
                <Badge tone={DOC_STATUS_TONE[i.status]}>{DOC_STATUS_LABELS[i.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
