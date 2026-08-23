import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, LinkButton, EmptyState, Alert } from "@/components/ui/primitives";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { PhotoGallery } from "@/components/ui/PhotoUploader";
import { EquipmentActions } from "./EquipmentActions";
import { formatDate } from "@/lib/format";
import { AMC_TONE, JOB_STATUS_TONE } from "@/lib/ui";
import { AMC_STATUS_LABELS, EQUIPMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/lib/masters";

const EXPIRY_WARNING_DAYS = 60;

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
}

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("equipment.view");
  const { id } = await params;

  const equipment = await prisma.equipment.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, code: true, companyName: true } },
      site: { select: { id: true, code: true, name: true, city: true, state: true } },
      jobs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { serviceType: { select: { name: true } }, engineer: { select: { name: true } } },
      },
      photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!equipment) notFound();

  const jobIds = equipment.jobs.map((j) => j.id);
  const [visits, moms, dailyReports, finalReports] = await Promise.all([
    prisma.siteVisit.findMany({ where: { jobId: { in: jobIds }, deletedAt: null }, orderBy: { visitDate: "desc" }, take: 20, select: { id: true, visitNumber: true, visitDate: true, status: true } }),
    prisma.mom.findMany({ where: { jobId: { in: jobIds }, deletedAt: null }, orderBy: { meetingDate: "desc" }, take: 20, select: { id: true, momNumber: true, meetingDate: true, status: true } }),
    prisma.dailyWorkReport.findMany({ where: { jobId: { in: jobIds }, deletedAt: null }, orderBy: { reportDate: "desc" }, take: 20, select: { id: true, reportNumber: true, reportDate: true, status: true } }),
    prisma.finalServiceReport.findMany({ where: { jobId: { in: jobIds }, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reportNumber: true, completionDate: true, status: true } }),
  ]);

  const amcDaysLeft = daysUntil(equipment.amcValidUpto);
  const warrantyDaysLeft = daysUntil(equipment.warrantyUpto);
  const amcExpiringSoon = equipment.amcStatus === "UNDER_AMC" && amcDaysLeft !== null && amcDaysLeft <= EXPIRY_WARNING_DAYS;

  const timeline: TimelineEntry[] = [
    ...equipment.jobs.map((j) => ({
      id: `job-${j.id}`, title: `Job ${j.jobNumber} — ${j.serviceType.name}`,
      description: j.engineer ? j.engineer.name : undefined,
      at: j.createdAt, tone: "primary" as const, href: `/jobs/${j.id}`,
      meta: JOB_STATUS_LABELS[j.status],
    })),
    ...visits.map((v) => ({ id: `visit-${v.id}`, title: `Site visit ${v.visitNumber}`, at: v.visitDate, tone: "neutral" as const, href: `/visits/${v.id}` })),
    ...moms.map((m) => ({ id: `mom-${m.id}`, title: `MOM ${m.momNumber}`, at: m.meetingDate, tone: "warning" as const, href: `/mom/${m.id}` })),
    ...dailyReports.map((d) => ({ id: `dwr-${d.id}`, title: `Daily report ${d.reportNumber}`, at: d.reportDate, tone: "neutral" as const, href: `/daily-reports/${d.id}` })),
    ...finalReports.map((f) => ({ id: `fsr-${f.id}`, title: `Final Service Report ${f.reportNumber}`, at: f.completionDate ?? new Date(), tone: "success" as const, href: `/final-reports/${f.id}` })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  const specEntries = Object.entries((equipment.specifications as Record<string, string> | null) ?? {});

  return (
    <>
      <PageHeader
        title={equipment.name}
        description={`${equipment.code} · ${equipment.customer.companyName} · ${equipment.site.name}`}
        crumbs={[{ label: "Equipment", href: "/equipment" }, { label: equipment.name }]}
        actions={<EquipmentActions equipment={JSON.parse(JSON.stringify(equipment))} />}
      />

      {amcExpiringSoon && (
        <Alert tone={amcDaysLeft !== null && amcDaysLeft < 0 ? "danger" : "warning"} title={amcDaysLeft !== null && amcDaysLeft < 0 ? "AMC has expired" : "AMC expiring soon"} className="mb-5">
          {amcDaysLeft !== null && amcDaysLeft < 0
            ? `The AMC for ${equipment.name} expired ${formatDate(equipment.amcValidUpto)}. Renew it to keep the equipment under contract.`
            : `The AMC for ${equipment.name} expires on ${formatDate(equipment.amcValidUpto)} (in ${amcDaysLeft} day${amcDaysLeft === 1 ? "" : "s"}).`}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Equipment details">
            <DetailGrid>
              <DetailRow label="Equipment code">{equipment.code}</DetailRow>
              <DetailRow label="Status">
                <Badge tone={equipment.status === "ACTIVE" ? "success" : "neutral"} dot>
                  {equipment.status === "ACTIVE" ? "Active" : "Inactive"}
                </Badge>
              </DetailRow>
              <DetailRow label="Customer">
                <Link href={`/customers/${equipment.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {equipment.customer.companyName}
                </Link>
              </DetailRow>
              <DetailRow label="Site">
                <Link href={`/sites/${equipment.site.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {equipment.site.name}
                </Link>
              </DetailRow>
              <DetailRow label="Type">
                {EQUIPMENT_TYPE_LABELS[equipment.type]}
                {equipment.type === "OTHER" && equipment.typeOther ? ` — ${equipment.typeOther}` : ""}
              </DetailRow>
              <DetailRow label="Make">{equipment.make}</DetailRow>
              <DetailRow label="Model">{equipment.model}</DetailRow>
              <DetailRow label="Serial number">{equipment.serialNumber}</DetailRow>
              <DetailRow label="Capacity">{equipment.capacity}</DetailRow>
              <DetailRow label="Fuel type">{equipment.fuelType}</DetailRow>
              <DetailRow label="Installation date">{formatDate(equipment.installationDate)}</DetailRow>
              <DetailRow label="Commissioning date">{formatDate(equipment.commissioningDate)}</DetailRow>
              <DetailRow label="Warranty upto">
                <span className={warrantyDaysLeft !== null && warrantyDaysLeft < 0 ? "font-medium text-red-600" : warrantyDaysLeft !== null && warrantyDaysLeft <= EXPIRY_WARNING_DAYS ? "font-medium text-amber-700" : undefined}>
                  {formatDate(equipment.warrantyUpto)}
                </span>
              </DetailRow>
              <DetailRow label="AMC status">
                <Badge tone={AMC_TONE[equipment.amcStatus]}>{AMC_STATUS_LABELS[equipment.amcStatus]}</Badge>
              </DetailRow>
              <DetailRow label="AMC valid upto">
                <span className={amcDaysLeft !== null && amcDaysLeft < 0 ? "font-medium text-red-600" : amcDaysLeft !== null && amcDaysLeft <= EXPIRY_WARNING_DAYS ? "font-medium text-amber-700" : undefined}>
                  {formatDate(equipment.amcValidUpto)}
                </span>
              </DetailRow>
              <DetailRow label="Remarks" className="sm:col-span-2">{equipment.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title={`Specifications (${specEntries.length})`}>
            {specEntries.length === 0 ? (
              <EmptyState title="No specifications recorded" description="Add design pressure, temperature and other technical specifications when editing this equipment." />
            ) : (
              <DetailGrid>
                {specEntries.map(([key, value]) => (
                  <DetailRow key={key} label={key}>{value}</DetailRow>
                ))}
              </DetailGrid>
            )}
          </Card>

          <Card title={`Service jobs (${equipment.jobs.length})`} bodyClassName={equipment.jobs.length ? "p-0" : undefined}>
            {equipment.jobs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No service jobs yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {equipment.jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{j.jobNumber}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {j.serviceType.name}{j.engineer ? ` · ${j.engineer.name}` : ""} · {formatDate(j.requestDate)}
                        </span>
                      </span>
                      <Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABELS[j.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Photos">
            <PhotoGallery
              photos={JSON.parse(JSON.stringify(equipment.photos))}
              canDelete={can(user.permissions, "photos.delete")}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Quick actions">
            <div className="grid gap-2">
              <LinkButton href={`/jobs/new?equipmentId=${equipment.id}&siteId=${equipment.site.id}&customerId=${equipment.customer.id}`} variant="primary" size="md">
                <ClipboardList className="h-4 w-4" /> New service job
              </LinkButton>
            </div>
          </Card>

          <Card title="Reports">
            <div className="space-y-3 text-sm">
              <ReportGroup icon={FileText} label="Site visits" items={visits.map((v) => ({ id: v.id, label: v.visitNumber, href: `/visits/${v.id}`, sub: formatDate(v.visitDate) }))} />
              <ReportGroup icon={FileText} label="MOM" items={moms.map((m) => ({ id: m.id, label: m.momNumber, href: `/mom/${m.id}`, sub: formatDate(m.meetingDate) }))} />
              <ReportGroup icon={FileText} label="Daily reports" items={dailyReports.map((d) => ({ id: d.id, label: d.reportNumber, href: `/daily-reports/${d.id}`, sub: formatDate(d.reportDate) }))} />
              <ReportGroup icon={FileText} label="Final reports" items={finalReports.map((f) => ({ id: f.id, label: f.reportNumber, href: `/final-reports/${f.id}`, sub: formatDate(f.completionDate) }))} />
            </div>
          </Card>

          <Card title="Service history">
            <Timeline entries={timeline} />
          </Card>
        </div>
      </div>
    </>
  );
}

function ReportGroup({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ElementType;
  label: string;
  items: { id: string; label: string; href: string; sub: string }[];
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
        <Icon className="h-3.5 w-3.5" /> {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">None yet</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2">
              <Link href={i.href} className="truncate text-xs font-medium text-[var(--te-primary)] hover:underline">
                {i.label}
              </Link>
              <span className="shrink-0 text-[11px] text-slate-400">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
