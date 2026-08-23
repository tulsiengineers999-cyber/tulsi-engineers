import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { FieldDailyForm } from "./FieldDailyForm";
import type { FieldJobOption } from "../../visits/new/FieldVisitForm";

export default async function NewFieldDailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const user = await requirePermission("daily_reports.create");
  const { jobId } = await searchParams;

  const jobs = await prisma.serviceJob.findMany({
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
    take: 100,
    select: {
      id: true,
      jobNumber: true,
      customer: { select: { companyName: true } },
      site: { select: { name: true } },
      serviceType: { select: { name: true } },
      equipment: { select: { name: true, serialNumber: true } },
    },
  });

  const options: FieldJobOption[] = jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    customerName: j.customer.companyName,
    siteName: j.site.name,
    serviceTypeName: j.serviceType.name,
    equipmentName: j.equipment?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Daily work</h1>
        <p className="text-sm text-slate-500">Record today&apos;s work before you leave site.</p>
      </div>
      <FieldDailyForm jobs={options} defaultJobId={jobId} engineerId={user.id} />
    </div>
  );
}
