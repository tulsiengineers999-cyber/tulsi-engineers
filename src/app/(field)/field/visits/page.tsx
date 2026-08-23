import Link from "next/link";
import { CarFront, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";

export default async function FieldVisitsPage() {
  const user = await requirePermission("visits.view");
  const canCreate = can(user.permissions, "visits.create");

  const visits = await prisma.siteVisit.findMany({
    where: {
      deletedAt: null,
      OR: [
        { engineerId: user.id },
        { job: { technicianId: user.id } },
        { job: { assignments: { some: { userId: user.id, unassignedAt: null } } } },
      ],
    },
    orderBy: { visitDate: "desc" },
    take: 100,
    select: {
      id: true, visitNumber: true, visitDate: true, status: true, purpose: true,
      job: { select: { jobNumber: true } },
      customer: { select: { companyName: true } },
      site: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Site Visits</h1>
          <p className="text-sm text-slate-500">{visits.length} visit{visits.length === 1 ? "" : "s"}</p>
        </div>
        {canCreate ? (
          <Link href="/field/visits/new" className="te-focus flex h-11 items-center gap-1.5 rounded-md bg-[var(--te-primary)] px-4 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> New visit
          </Link>
        ) : null}
      </div>

      {visits.length === 0 ? (
        <Card>
          <EmptyState
            icon={CarFront}
            title="No site visits recorded yet"
            description={canCreate ? "Record your first site visit for a job you have been assigned." : "Visits you record will appear here."}
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/visits/${v.id}`} className="te-focus block">
                <Card bodyClassName="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{v.visitNumber}</p>
                      <p className="truncate text-xs text-slate-500">{v.job.jobNumber} · {v.customer.companyName} · {v.site.name}</p>
                    </div>
                    <Badge tone={DOC_STATUS_TONE[v.status]}>{DOC_STATUS_LABELS[v.status]}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{formatDate(v.visitDate)}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
