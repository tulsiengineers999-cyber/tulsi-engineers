import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import type { GalleryPhoto } from "@/components/ui/PhotoUploader";
import { FieldPhotoPanel, type FieldPhotoJob } from "./FieldPhotoPanel";

export default async function FieldPhotosPage() {
  const user = await requirePermission("photos.view");

  const [photosRaw, jobs] = await Promise.all([
    prisma.photo.findMany({
      where: { deletedAt: null, uploadedById: user.id },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.serviceJob.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["CLOSED", "CANCELLED"] },
        OR: [
          { engineerId: user.id },
          { technicianId: user.id },
          { assignments: { some: { userId: user.id, unassignedAt: null } } },
        ],
      },
      orderBy: [{ plannedVisitDate: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: { id: true, jobNumber: true, customer: { select: { companyName: true } } },
    }),
  ]);

  const photos: GalleryPhoto[] = photosRaw.map((p) => ({
    id: p.id,
    category: p.category,
    fileName: p.fileName,
    description: p.description,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt.toISOString(),
  }));

  const jobOptions: FieldPhotoJob[] = jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    customerName: j.customer.companyName,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Photographs</h1>
        <p className="text-sm text-slate-500">
          {photos.length} photo{photos.length === 1 ? "" : "s"} uploaded by you
        </p>
      </div>
      <FieldPhotoPanel jobs={jobOptions} photos={photos} canUpload={can(user.permissions, "photos.create")} />
    </div>
  );
}
