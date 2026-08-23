import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import type { GalleryPhoto } from "@/components/ui/PhotoUploader";
import { VisitActions } from "./VisitActions";
import { PhotoPanel } from "./PhotoPanel";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";
import { FileText } from "lucide-react";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("visits.view");
  const { id } = await params;

  const visit = await prisma.siteVisit.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, companyName: true } },
      site: { select: { id: true, name: true, address: true, city: true, state: true, pinCode: true } },
      engineer: { select: { id: true, name: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          serviceType: { select: { name: true } },
          equipment: { select: { id: true, name: true, serialNumber: true } },
        },
      },
      moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" }, select: { id: true, momNumber: true, meetingDate: true, status: true } },
    },
  });
  if (!visit) notFound();

  const photosRaw = await prisma.photo.findMany({
    where: { siteVisitId: id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { name: true } } },
  });

  const photos: GalleryPhoto[] = photosRaw.map((p) => ({
    id: p.id,
    category: p.category,
    fileName: p.fileName,
    description: p.description,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy,
  }));

  const permissions = {
    canEdit: can(user.permissions, "visits.edit"),
    canDelete: can(user.permissions, "visits.delete"),
    canPdf: can(user.permissions, "visits.pdf"),
    canCreateMom: can(user.permissions, "mom.create"),
  };

  const siteAddress = [visit.site.address, visit.site.city, visit.site.state, visit.site.pinCode]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        title={visit.visitNumber}
        description={`${visit.customer.companyName} · ${visit.site.name} · ${formatDate(visit.visitDate)}`}
        crumbs={[{ label: "Site Visits", href: "/visits" }, { label: visit.visitNumber }]}
        actions={<Badge tone={DOC_STATUS_TONE[visit.status] ?? "neutral"}>{DOC_STATUS_LABELS[visit.status] ?? visit.status}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Visit details">
            <DetailGrid>
              <DetailRow label="Service job">
                <Link href={`/jobs/${visit.job.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {visit.job.jobNumber}
                </Link>
              </DetailRow>
              <DetailRow label="Service type">{visit.job.serviceType.name}</DetailRow>
              <DetailRow label="Customer">
                <Link href={`/customers/${visit.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {visit.customer.companyName}
                </Link>
              </DetailRow>
              <DetailRow label="Site">
                <Link href={`/sites/${visit.site.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {visit.site.name}
                </Link>
              </DetailRow>
              <DetailRow label="Site address">{siteAddress}</DetailRow>
              <DetailRow label="Equipment">
                {visit.job.equipment ? (
                  <Link href={`/equipment/${visit.job.equipment.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                    {visit.job.equipment.name}
                    {visit.job.equipment.serialNumber ? ` (Sr. ${visit.job.equipment.serialNumber})` : ""}
                  </Link>
                ) : (
                  visit.equipmentDetails
                )}
              </DetailRow>
              <DetailRow label="Visit date">{formatDate(visit.visitDate)}</DetailRow>
              <DetailRow label="Engineer">{visit.engineer?.name}</DetailRow>
              <DetailRow label="Arrival time">{visit.arrivalTime}</DetailRow>
              <DetailRow label="Departure time">{visit.departureTime}</DetailRow>
              <DetailRow label="Technician(s)">{visit.technicianNames}</DetailRow>
              <DetailRow label="Customer representative">{visit.customerRepresentative}</DetailRow>
              <DetailRow label="Purpose">{visit.purpose}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Observations">
            <DetailGrid cols={1}>
              <DetailRow label="Problem observed">{visit.problemObserved}</DetailRow>
              <DetailRow label="Initial observation">{visit.initialObservation}</DetailRow>
              <DetailRow label="Required action">{visit.requiredAction}</DetailRow>
              <DetailRow label="Material required">{visit.materialRequired}</DetailRow>
              <DetailRow label="Spares required">{visit.spareRequired}</DetailRow>
              <DetailRow label="Site condition">{visit.siteCondition}</DetailRow>
              <DetailRow label="Remarks">{visit.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <PhotoPanel
            siteVisitId={visit.id}
            jobId={visit.job.id}
            photos={photos}
            canUpload={can(user.permissions, "photos.create")}
            canDelete={can(user.permissions, "photos.delete")}
          />
        </div>

        <div className="space-y-5">
          <Card title="Actions">
            <VisitActions
              visit={{ id: visit.id, visitNumber: visit.visitNumber, jobId: visit.job.id, status: visit.status }}
              permissions={permissions}
            />
          </Card>

          <Card title={`Minutes of Meeting (${visit.moms.length})`} bodyClassName={visit.moms.length ? "p-0" : undefined}>
            {visit.moms.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No MOM yet"
                description="Create a MOM from this visit to record decisions and action points."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {visit.moms.map((m) => (
                  <li key={m.id}>
                    <Link href={`/mom/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{m.momNumber}</span>
                        <span className="block text-xs text-slate-500">{formatDate(m.meetingDate)}</span>
                      </span>
                      <Badge tone={DOC_STATUS_TONE[m.status] ?? "neutral"}>{DOC_STATUS_LABELS[m.status] ?? m.status}</Badge>
                    </Link>
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
