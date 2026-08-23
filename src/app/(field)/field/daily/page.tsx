import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";

export default async function FieldDailyReportsPage() {
  const user = await requirePermission("daily_reports.view");
  const canCreate = can(user.permissions, "daily_reports.create");

  const reports = await prisma.dailyWorkReport.findMany({
    where: {
      deletedAt: null,
      OR: [
        { engineerId: user.id },
        { job: { technicianId: user.id } },
        { job: { assignments: { some: { userId: user.id, unassignedAt: null } } } },
      ],
    },
    orderBy: { reportDate: "desc" },
    take: 100,
    select: {
      id: true, reportNumber: true, reportDate: true, status: true, workHours: true, progressPercent: true,
      job: { select: { jobNumber: true }, },
    },
  });

  const groups = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = formatDate(r.reportDate);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Daily Work Reports</h1>
          <p className="text-sm text-slate-500">{reports.length} report{reports.length === 1 ? "" : "s"}</p>
        </div>
        {canCreate ? (
          <Link href="/field/daily/new" className="te-focus flex h-11 items-center gap-1.5 rounded-md bg-[var(--te-primary)] px-4 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> New report
          </Link>
        ) : null}
      </div>

      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="No daily work reports yet"
            description={canCreate ? "Log the work you carry out each day against your assigned jobs." : "Reports you submit will appear here."}
          />
        </Card>
      ) : (
        [...groups.entries()].map(([date, list]) => (
          <section key={date}>
            <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{date}</h2>
            <ul className="space-y-2.5">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/daily-reports/${r.id}`} className="te-focus block">
                    <Card bodyClassName="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{r.reportNumber}</p>
                          <p className="truncate text-xs text-slate-500">{r.job.jobNumber}</p>
                        </div>
                        <Badge tone={DOC_STATUS_TONE[r.status]}>{DOC_STATUS_LABELS[r.status]}</Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {r.workHours != null ? `${r.workHours} hrs · ` : ""}{r.progressPercent}% progress
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
