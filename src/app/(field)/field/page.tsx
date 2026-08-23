import Link from "next/link";
import { ClipboardList, MapPin, Phone, Navigation } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { JOB_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/masters";
import { JOB_STATUS_TONE, PRIORITY_TONE } from "@/lib/ui";
import type { JobStatus, Priority } from "@/generated/prisma";

const ACTIVE_JOB = new Set<JobStatus>(["WORK_STARTED", "WORK_IN_PROGRESS", "MOM_CREATED", "CONFIRMATION_PENDING"]);
const NOT_STARTED = new Set<JobStatus>(["NEW", "ASSIGNED", "SITE_VISIT"]);
const DONE = new Set<JobStatus>(["COMPLETED", "CLOSED"]);

interface JobCardData {
  id: string;
  jobNumber: string;
  priority: Priority;
  status: JobStatus;
  plannedVisitDate: Date | null;
  completedAt: Date | null;
  customer: { companyName: string; mobile: string | null };
  site: { name: string; contactPerson: string | null; mobile: string | null; latitude: number | null; longitude: number | null };
  serviceType: { name: string };
}

export default async function FieldMyJobsPage() {
  const user = await requirePermission("jobs.view");

  const jobs = await prisma.serviceJob.findMany({
    where: {
      deletedAt: null,
      status: { not: "CANCELLED" },
      OR: [
        { engineerId: user.id },
        { technicianId: user.id },
        { assignments: { some: { userId: user.id, unassignedAt: null } } },
      ],
    },
    orderBy: [{ plannedVisitDate: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true, jobNumber: true, priority: true, status: true, plannedVisitDate: true, completedAt: true,
      customer: { select: { companyName: true, mobile: true } },
      site: { select: { name: true, contactPerson: true, mobile: true, latitude: true, longitude: true } },
      serviceType: { select: { name: true } },
    },
  });

  const today = new Date();
  const isSameDay = (d: Date | null) =>
    d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const seen = new Set<string>();
  const bucket = (list: JobCardData[]) => list.filter((j) => !seen.has(j.id) && (seen.add(j.id), true));

  const todays = bucket(jobs.filter((j) => isSameDay(j.plannedVisitDate) && !DONE.has(j.status)));
  const inProgress = bucket(jobs.filter((j) => ACTIVE_JOB.has(j.status)));
  const upcoming = bucket(
    jobs.filter((j) => NOT_STARTED.has(j.status) && j.plannedVisitDate && j.plannedVisitDate.getTime() > today.getTime()),
  );
  const recentlyCompleted = bucket(
    jobs
      .filter((j) => DONE.has(j.status))
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
      .slice(0, 10),
  );

  const groups: { title: string; items: JobCardData[] }[] = [
    { title: "Today", items: todays },
    { title: "In progress", items: inProgress },
    { title: "Upcoming", items: upcoming },
    { title: "Recently completed", items: recentlyCompleted },
  ];

  const total = jobs.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Jobs</h1>
        <p className="mt-0.5 text-sm text-slate-500">Jobs assigned to you, {user.name.split(" ")[0]}.</p>
      </div>

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No jobs assigned to you yet"
            description="When a service job is assigned to you, it will show up here — grouped by what's happening today, in progress, upcoming and recently completed."
          />
        </Card>
      ) : (
        groups.map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.title}>
                <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {g.title} ({g.items.length})
                </h2>
                <div className="space-y-3">
                  {g.items.map((j) => (
                    <JobCard key={j.id} job={j} />
                  ))}
                </div>
              </section>
            ),
        )
      )}
    </div>
  );
}

function JobCard({ job }: { job: JobCardData }) {
  const mapsHref =
    job.site.latitude != null && job.site.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${job.site.latitude},${job.site.longitude}`
      : null;
  const phone = job.site.mobile || job.customer.mobile;

  return (
    <Card bodyClassName="relative p-4" className="active:scale-[0.99] transition-transform">
      <Link href={`/field/jobs/${job.id}`} className="te-focus absolute inset-0 z-10 rounded-xl" aria-label={`Open job ${job.jobNumber}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{job.jobNumber}</p>
          <p className="truncate text-sm text-slate-600">{job.customer.companyName}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" /> {job.site.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABELS[job.priority]}</Badge>
          <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <p className="text-xs text-slate-500">
          {job.serviceType.name} · {job.plannedVisitDate ? formatDate(job.plannedVisitDate) : "No date set"}
        </p>
        <div className="relative z-20 flex items-center gap-1.5">
          {phone && (
            <a
              href={`tel:${phone}`}
              aria-label="Call site contact"
              className="te-focus grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate to site"
              className="te-focus grid h-9 w-9 place-items-center rounded-full border border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]"
            >
              <Navigation className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
