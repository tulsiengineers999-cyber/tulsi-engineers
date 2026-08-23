import Link from "next/link";
import { notFound } from "next/navigation";
import { CarFront, FileText, CalendarPlus, Camera, MapPin, Navigation, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { Badge, Card, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import { PhotoGallery, PhotoUploader, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_LABELS, JOB_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE, JOB_STATUS_TONE, PRIORITY_TONE } from "@/lib/ui";

export default async function FieldJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("jobs.view");
  const { id } = await params;

  const job = await prisma.serviceJob.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, companyName: true, mobile: true } },
      site: { select: { id: true, name: true, address: true, city: true, mobile: true, contactPerson: true, latitude: true, longitude: true } },
      equipment: { select: { id: true, name: true, serialNumber: true } },
      serviceType: { select: { name: true } },
      visits: { where: { deletedAt: null }, orderBy: { visitDate: "desc" }, select: { id: true, visitNumber: true, visitDate: true, status: true } },
      moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" }, select: { id: true, momNumber: true, meetingDate: true, status: true } },
      dailyReports: { where: { deletedAt: null }, orderBy: { reportDate: "desc" }, select: { id: true, reportNumber: true, reportDate: true, status: true } },
      photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!job) notFound();

  const permissions = {
    canCreateVisit: can(user.permissions, "visits.create"),
    canCreateMom: can(user.permissions, "mom.create"),
    canCreateDaily: can(user.permissions, "daily_reports.create"),
    canUploadPhoto: can(user.permissions, "photos.create"),
  };

  const mapsHref =
    job.site.latitude != null && job.site.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${job.site.latitude},${job.site.longitude}`
      : null;
  const phone = job.site.mobile || job.customer.mobile;

  const photos: GalleryPhoto[] = job.photos.map((p) => ({
    id: p.id, category: p.category, fileName: p.fileName, description: p.description,
    sizeBytes: p.sizeBytes, createdAt: p.createdAt.toISOString(), uploadedBy: p.uploadedBy,
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{job.jobNumber}</p>
        <h1 className="text-lg font-bold text-slate-900">{job.customer.companyName}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABELS[job.priority]}</Badge>
          <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
        </div>
      </div>

      <Card title="Site">
        <div className="space-y-1 text-sm">
          <p className="flex items-start gap-1.5 text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{job.site.name}{[job.site.address, job.site.city].filter(Boolean).length ? ` — ${[job.site.address, job.site.city].filter(Boolean).join(", ")}` : ""}</span>
          </p>
          {job.site.contactPerson && <p className="pl-6 text-slate-500">Contact: {job.site.contactPerson}</p>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mapsHref ? (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="te-focus flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--te-primary)] text-sm font-semibold text-white">
              <Navigation className="h-4 w-4" /> Navigate
            </a>
          ) : (
            <span className="flex h-11 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">No coordinates saved</span>
          )}
          {phone ? (
            <a href={`tel:${phone}`} className="te-focus flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700">
              <Phone className="h-4 w-4" /> Call site
            </a>
          ) : (
            <span className="flex h-11 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">No number saved</span>
          )}
        </div>
      </Card>

      <Card title="Job details">
        <DetailGrid cols={1}>
          <DetailRow label="Equipment">
            {job.equipment ? `${job.equipment.name}${job.equipment.serialNumber ? ` (Sr. ${job.equipment.serialNumber})` : ""}` : "—"}
          </DetailRow>
          <DetailRow label="Service type">{job.serviceType.name}</DetailRow>
          <DetailRow label="Problem description">{job.problemDescription}</DetailRow>
          <DetailRow label="Customer's requirement">{job.customerRequirement}</DetailRow>
          <DetailRow label="Material required">{job.requiredMaterial}</DetailRow>
          <DetailRow label="Spares required">{job.requiredSpare}</DetailRow>
        </DetailGrid>
      </Card>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Progress</p>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[var(--te-primary)]" style={{ width: `${job.progressPercent}%` }} />
        </div>
        <p className="mt-1 text-right text-xs font-semibold text-slate-600">{job.progressPercent}%</p>
      </div>

      <div className="grid gap-2.5">
        <ActionLink
          href={`/field/visits/new?jobId=${job.id}`}
          icon={CarFront}
          label="Start site visit"
          allowed={permissions.canCreateVisit}
          reason="You do not have permission to create site visits."
        />
        <ActionLink
          href={`/mom/new?jobId=${job.id}`}
          icon={FileText}
          label="Create MOM"
          allowed={permissions.canCreateMom}
          reason="You do not have permission to create a Minutes of Meeting."
        />
        <ActionLink
          href={`/field/daily/new?jobId=${job.id}`}
          icon={CalendarPlus}
          label="Add daily work"
          allowed={permissions.canCreateDaily}
          reason="You do not have permission to create daily work reports."
        />
        <ActionLink
          href="#photos"
          icon={Camera}
          label="Upload photos"
          allowed={permissions.canUploadPhoto}
          reason="You do not have permission to upload photos."
        />
      </div>

      <RecordList title="Site visits" items={job.visits.map((v) => ({ id: v.id, label: v.visitNumber, href: `/visits/${v.id}`, sub: formatDate(v.visitDate), status: v.status }))} />
      <RecordList title="MOMs" items={job.moms.map((m) => ({ id: m.id, label: m.momNumber, href: `/mom/${m.id}`, sub: formatDate(m.meetingDate), status: m.status }))} />
      <RecordList title="Daily work reports" items={job.dailyReports.map((d) => ({ id: d.id, label: d.reportNumber, href: `/daily-reports/${d.id}`, sub: formatDate(d.reportDate), status: d.status }))} />

      <div id="photos" className="scroll-mt-4">
        <Card title={`Photos (${photos.length})`}>
          {photos.length === 0 ? (
            <EmptyState icon={Camera} title="No photos uploaded yet" />
          ) : (
            <PhotoGallery photos={photos} />
          )}
          {permissions.canUploadPhoto && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <PhotoUploader link={{ jobId: job.id }} defaultCategory="DURING_WORK" compact />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  allowed,
  reason,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  allowed: boolean;
  reason: string;
}) {
  if (!allowed) {
    return (
      <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-400">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs">{reason}</span>
        </span>
      </div>
    );
  }
  return (
    <Link href={href} className="te-focus flex h-14 items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-slate-800 shadow-sm active:bg-slate-50">
      <Icon className="h-5 w-5 shrink-0 text-[var(--te-primary)]" />
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

function RecordList({
  title,
  items,
}: {
  title: string;
  items: { id: string; label: string; href: string; sub: string; status: string }[];
}) {
  return (
    <Card title={`${title} (${items.length})`} bodyClassName={items.length ? "p-0" : undefined}>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">None yet</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="flex items-center justify-between gap-3 px-4 py-3">
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
