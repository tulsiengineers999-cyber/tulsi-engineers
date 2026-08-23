import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/primitives";
import { VisitForm } from "../../VisitForm";
import { formatDateInput } from "@/lib/format";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("visits.edit");
  const { id } = await params;

  const visit = await prisma.siteVisit.findFirst({ where: { id, deletedAt: null } });
  if (!visit) notFound();

  const locked = visit.status === "CLIENT_CONFIRMED";

  return (
    <>
      <PageHeader
        title={`Edit ${visit.visitNumber}`}
        description="Changes are recorded in the audit log."
        crumbs={[
          { label: "Site Visits", href: "/visits" },
          { label: visit.visitNumber, href: `/visits/${visit.id}` },
          { label: "Edit" },
        ]}
      />

      {locked ? (
        <Alert tone="warning" title="This visit has been confirmed by the client">
          Confirmed records are locked so the version the client agreed to cannot change. Contact your administrator
          if a correction is genuinely needed.
        </Alert>
      ) : (
        <VisitForm
          visitId={visit.id}
          lockedJobId={visit.jobId}
          initial={{
            jobId: visit.jobId,
            visitDate: formatDateInput(visit.visitDate),
            arrivalTime: visit.arrivalTime ?? "",
            departureTime: visit.departureTime ?? "",
            engineerId: visit.engineerId ?? "",
            technicianNames: visit.technicianNames ?? "",
            customerRepresentative: visit.customerRepresentative ?? "",
            purpose: visit.purpose ?? "",
            equipmentDetails: visit.equipmentDetails ?? "",
            problemObserved: visit.problemObserved ?? "",
            initialObservation: visit.initialObservation ?? "",
            requiredAction: visit.requiredAction ?? "",
            materialRequired: visit.materialRequired ?? "",
            spareRequired: visit.spareRequired ?? "",
            siteCondition: visit.siteCondition ?? "",
            remarks: visit.remarks ?? "",
          }}
        />
      )}
    </>
  );
}
