import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { JobStatus, Prisma } from "@/generated/prisma";
import { JOB_STATUS_LABELS } from "@/lib/masters";

const OPEN_EXCLUDE: JobStatus[] = ["COMPLETED", "CLOSED", "CANCELLED"];
const ACTIVE_STATUSES: JobStatus[] = ["WORK_STARTED", "WORK_IN_PROGRESS"];
const DONE_STATUSES: JobStatus[] = ["COMPLETED", "CLOSED"];

function dateRange(from: string | null, to: string | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("dashboard.view");
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const customerId = sp.get("customerId") || undefined;
    const siteId = sp.get("siteId") || undefined;
    const engineerId = sp.get("engineerId") || undefined;
    const serviceTypeId = sp.get("serviceTypeId") || undefined;
    const status = (sp.get("status") as JobStatus | null) || undefined;

    const requestDateRange = dateRange(from, to);

    const jobAnd: Prisma.ServiceJobWhereInput[] = [{ deletedAt: null }];
    if (customerId) jobAnd.push({ customerId });
    if (siteId) jobAnd.push({ siteId });
    if (engineerId) jobAnd.push({ engineerId });
    if (serviceTypeId) jobAnd.push({ serviceTypeId });
    if (status) jobAnd.push({ status });
    if (requestDateRange) jobAnd.push({ requestDate: requestDateRange });
    const jobWhere: Prisma.ServiceJobWhereInput = { AND: jobAnd };

    const momAnd: Prisma.MomWhereInput[] = [{ deletedAt: null }];
    if (customerId) momAnd.push({ customerId });
    if (siteId) momAnd.push({ siteId });
    if (engineerId || serviceTypeId) {
      momAnd.push({
        job: {
          ...(engineerId ? { engineerId } : {}),
          ...(serviceTypeId ? { serviceTypeId } : {}),
        },
      });
    }
    if (requestDateRange) momAnd.push({ meetingDate: requestDateRange });

    const dwrAnd: Prisma.DailyWorkReportWhereInput[] = [{ deletedAt: null }];
    if (customerId || siteId || engineerId || serviceTypeId) {
      dwrAnd.push({
        job: {
          ...(customerId ? { customerId } : {}),
          ...(siteId ? { siteId } : {}),
          ...(engineerId ? { engineerId } : {}),
          ...(serviceTypeId ? { serviceTypeId } : {}),
        },
      });
    }
    if (requestDateRange) dwrAnd.push({ reportDate: requestDateRange });

    const confirmAnd: Prisma.ClientConfirmationWhereInput[] = [];
    if (customerId) confirmAnd.push({ customerId });
    if (requestDateRange) confirmAnd.push({ createdAt: requestDateRange });

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const weekAhead = endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
    const tomorrowStart = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));

    const visitAnd: Prisma.SiteVisitWhereInput[] = [{ deletedAt: null }];
    if (customerId) visitAnd.push({ customerId });
    if (siteId) visitAnd.push({ siteId });
    if (engineerId) visitAnd.push({ engineerId });
    if (serviceTypeId) visitAnd.push({ job: { serviceTypeId } });

    const [
      totalCustomers,
      totalSites,
      totalEquipment,
      openJobs,
      activeJobs,
      completedJobs,
      overdueJobs,
      amcJobs,
      breakdownJobs,
      todaysVisits,
      upcomingVisits,
      pendingMom,
      momConfirmationPending,
      dailyReportsPending,
      clientConfirmationsPending,
      jobsByStatusRaw,
      jobsByServiceTypeRaw,
      engineerWorkloadRaw,
      confirmationStatusRaw,
      recentJobs,
      todaysVisitsList,
      pendingConfirmationsRaw,
      overdueActionPoints,
    ] = await Promise.all([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.site.count({ where: { deletedAt: null } }),
      prisma.equipment.count({ where: { deletedAt: null } }),
      prisma.serviceJob.count({ where: { AND: [...jobAnd, { status: { notIn: OPEN_EXCLUDE } }] } }),
      prisma.serviceJob.count({ where: { AND: [...jobAnd, { status: { in: ACTIVE_STATUSES } }] } }),
      prisma.serviceJob.count({ where: { AND: [...jobAnd, { status: { in: DONE_STATUSES } }] } }),
      prisma.serviceJob.count({
        where: {
          AND: [...jobAnd, { targetCompletionDate: { lt: today } }, { status: { notIn: OPEN_EXCLUDE } }],
        },
      }),
      prisma.serviceJob.count({
        where: {
          AND: [
            ...jobAnd,
            {
              OR: [
                { serviceType: { name: { contains: "AMC", mode: "insensitive" } } },
                { equipment: { amcStatus: "UNDER_AMC" } },
              ],
            },
          ],
        },
      }),
      prisma.serviceJob.count({
        where: { AND: [...jobAnd, { serviceType: { name: { contains: "Breakdown", mode: "insensitive" } } }] },
      }),
      prisma.siteVisit.count({ where: { AND: [...visitAnd, { visitDate: { gte: todayStart, lte: todayEnd } }] } }),
      prisma.siteVisit.count({
        where: { AND: [...visitAnd, { visitDate: { gte: tomorrowStart, lte: weekAhead } }] },
      }),
      prisma.mom.count({ where: { AND: [...momAnd, { status: { in: ["DRAFT", "SUBMITTED"] } }] } }),
      prisma.mom.count({ where: { AND: [...momAnd, { status: "CONFIRMATION_PENDING" }] } }),
      prisma.dailyWorkReport.count({ where: { AND: [...dwrAnd, { status: "SUBMITTED" }] } }),
      prisma.clientConfirmation.count({ where: { AND: [...confirmAnd, { status: "PENDING" }] } }),
      prisma.serviceJob.groupBy({ by: ["status"], where: jobWhere, _count: { _all: true } }),
      prisma.serviceJob.groupBy({
        by: ["serviceTypeId"],
        where: jobWhere,
        _count: { _all: true },
        orderBy: { _count: { serviceTypeId: "desc" } },
        take: 8,
      }),
      prisma.serviceJob.groupBy({
        by: ["engineerId", "status"],
        where: { AND: [...jobAnd, { engineerId: { not: null } }] },
        _count: { _all: true },
      }),
      prisma.clientConfirmation.groupBy({ by: ["status"], where: { AND: confirmAnd }, _count: { _all: true } }),
      prisma.serviceJob.findMany({
        where: jobWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true, jobNumber: true, status: true, createdAt: true,
          customer: { select: { companyName: true } },
          site: { select: { name: true } },
          serviceType: { select: { name: true } },
          engineer: { select: { name: true } },
        },
      }),
      prisma.siteVisit.findMany({
        where: { AND: [...visitAnd, { visitDate: { gte: todayStart, lte: todayEnd } }] },
        orderBy: { visitDate: "asc" },
        take: 8,
        select: {
          id: true, visitNumber: true, visitDate: true, arrivalTime: true,
          customer: { select: { companyName: true } },
          site: { select: { name: true } },
          engineer: { select: { name: true } },
        },
      }),
      prisma.clientConfirmation.findMany({
        where: { AND: [...confirmAnd, { status: "PENDING" }] },
        orderBy: { createdAt: "asc" },
        take: 8,
      }),
      prisma.momActionPoint.findMany({
        where: {
          AND: [
            { mom: { deletedAt: null, ...(customerId ? { customerId } : {}), ...(siteId ? { siteId } : {}) } },
            { dueDate: { lt: today } },
            { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          ],
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        include: {
          mom: {
            select: {
              id: true, momNumber: true,
              customer: { select: { companyName: true } },
              site: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    // Monthly activity — 12-month trend, jobs filtered, visits/reports company-wide.
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      });
    }
    const earliest = months[0].start;
    const [jobDates, visitDates, dwrDates, fsrDates] = await Promise.all([
      prisma.serviceJob.findMany({
        where: { AND: [...jobAnd, { createdAt: { gte: earliest } }] },
        select: { createdAt: true },
      }),
      prisma.siteVisit.findMany({
        where: { deletedAt: null, visitDate: { gte: earliest } },
        select: { visitDate: true },
      }),
      prisma.dailyWorkReport.findMany({
        where: { deletedAt: null, createdAt: { gte: earliest } },
        select: { createdAt: true },
      }),
      prisma.finalServiceReport.findMany({
        where: { deletedAt: null, createdAt: { gte: earliest } },
        select: { createdAt: true },
      }),
    ]);
    const monthlyActivity = months.map((m) => ({
      month: m.label,
      jobs: jobDates.filter((j) => j.createdAt >= m.start && j.createdAt < m.end).length,
      visits: visitDates.filter((v) => v.visitDate >= m.start && v.visitDate < m.end).length,
      reports:
        dwrDates.filter((r) => r.createdAt >= m.start && r.createdAt < m.end).length +
        fsrDates.filter((r) => r.createdAt >= m.start && r.createdAt < m.end).length,
    }));

    // jobs by service type — resolve names
    const serviceTypeIds = jobsByServiceTypeRaw.map((r) => r.serviceTypeId);
    const serviceTypes = serviceTypeIds.length
      ? await prisma.serviceType.findMany({ where: { id: { in: serviceTypeIds } }, select: { id: true, name: true } })
      : [];
    const serviceTypeNameById = new Map(serviceTypes.map((s) => [s.id, s.name]));
    const jobsByServiceType = jobsByServiceTypeRaw.map((r) => ({
      serviceTypeId: r.serviceTypeId,
      name: serviceTypeNameById.get(r.serviceTypeId) ?? "Unknown",
      count: r._count._all,
    }));

    // engineer workload — resolve names, bucket open/completed
    const engineerIds = [...new Set(engineerWorkloadRaw.map((r) => r.engineerId).filter((v): v is string => !!v))];
    const engineers = engineerIds.length
      ? await prisma.user.findMany({ where: { id: { in: engineerIds } }, select: { id: true, name: true } })
      : [];
    const engineerNameById = new Map(engineers.map((e) => [e.id, e.name]));
    const workloadMap = new Map<string, { engineerId: string; name: string; open: number; completed: number }>();
    for (const r of engineerWorkloadRaw) {
      if (!r.engineerId) continue;
      const entry = workloadMap.get(r.engineerId) ?? {
        engineerId: r.engineerId,
        name: engineerNameById.get(r.engineerId) ?? "Unknown",
        open: 0,
        completed: 0,
      };
      if (DONE_STATUSES.includes(r.status)) entry.completed += r._count._all;
      else if (r.status !== "CANCELLED") entry.open += r._count._all;
      workloadMap.set(r.engineerId, entry);
    }
    const engineerWorkload = [...workloadMap.values()].sort((a, b) => b.open + b.completed - (a.open + a.completed));

    const jobsByStatus = jobsByStatusRaw.map((r) => ({
      status: r.status,
      label: JOB_STATUS_LABELS[r.status] ?? r.status,
      count: r._count._all,
    }));

    const confirmationStatus = confirmationStatusRaw.map((r) => ({ status: r.status, count: r._count._all }));

    // pending confirmations — resolve customer names (no direct relation on the model)
    const confCustomerIds = [...new Set(pendingConfirmationsRaw.map((c) => c.customerId))];
    const confCustomers = confCustomerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: confCustomerIds } }, select: { id: true, companyName: true } })
      : [];
    const confCustomerNameById = new Map(confCustomers.map((c) => [c.id, c.companyName]));
    const docHref: Record<string, string> = {
      MOM: "/mom",
      DAILY_WORK_REPORT: "/daily-reports",
      FINAL_SERVICE_REPORT: "/final-reports",
      SITE_VISIT_REPORT: "/visits",
      AMC_REPORT: "/final-reports",
      INSPECTION_REPORT: "/final-reports",
    };
    const pendingConfirmations = pendingConfirmationsRaw.map((c) => ({
      id: c.id,
      recordNumber: c.recordNumber,
      docType: c.docType,
      customerName: c.clientName ?? confCustomerNameById.get(c.customerId) ?? "—",
      createdAt: c.createdAt,
      href: `${docHref[c.docType] ?? "/mom"}/${c.recordId}`,
    }));

    return ok({
      cards: {
        totalCustomers,
        totalSites,
        totalEquipment,
        openJobs,
        todaysVisits,
        upcomingVisits,
        pendingMom,
        momConfirmationPending,
        activeJobs,
        dailyReportsPending,
        clientConfirmationsPending,
        completedJobs,
        overdueJobs,
        amcJobs,
        breakdownJobs,
      },
      charts: {
        jobsByStatus,
        jobsByServiceType,
        engineerWorkload,
        monthlyActivity,
        confirmationStatus,
      },
      lists: {
        recentJobs: recentJobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          status: j.status,
          createdAt: j.createdAt,
          customerName: j.customer.companyName,
          siteName: j.site.name,
          serviceTypeName: j.serviceType.name,
          engineerName: j.engineer?.name ?? null,
        })),
        todaysVisitsList: todaysVisitsList.map((v) => ({
          id: v.id,
          visitNumber: v.visitNumber,
          visitDate: v.visitDate,
          arrivalTime: v.arrivalTime,
          customerName: v.customer.companyName,
          siteName: v.site.name,
          engineerName: v.engineer?.name ?? null,
        })),
        pendingConfirmations,
        overdueActionPoints: overdueActionPoints.map((a) => ({
          id: a.id,
          actionPoint: a.actionPoint,
          dueDate: a.dueDate,
          priority: a.priority,
          momId: a.mom.id,
          momNumber: a.mom.momNumber,
          customerName: a.mom.customer.companyName,
          siteName: a.mom.site.name,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
