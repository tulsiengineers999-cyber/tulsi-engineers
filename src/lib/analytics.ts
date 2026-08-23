/**
 * Report definitions shared by the Analytics screen and its export endpoint.
 * Kept out of the route file because Next.js only permits route handlers to be
 * exported from a route module.
 */
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/http";
import type { JobStatus, Prisma } from "@/generated/prisma";
import { JOB_STATUS_LABELS, DOC_TYPE_LABELS } from "@/lib/masters";
import { formatDate } from "@/lib/format";

export type ReportKey =
  | "customer-wise" | "site-wise" | "engineer-wise" | "service-wise" | "date-wise" | "job-wise"
  | "pending-jobs" | "completed-jobs" | "mom-pending" | "confirmation-pending" | "amc" | "breakdown"
  | "material-usage" | "spare-usage" | "work-hours";

export const REPORT_KEYS: ReportKey[] = [
  "customer-wise", "site-wise", "engineer-wise", "service-wise", "date-wise", "job-wise",
  "pending-jobs", "completed-jobs", "mom-pending", "confirmation-pending", "amc", "breakdown",
  "material-usage", "spare-usage", "work-hours",
];

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface ReportResult {
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
}

const DONE_STATUSES: JobStatus[] = ["COMPLETED", "CLOSED"];
const OPEN_EXCLUDE: JobStatus[] = ["COMPLETED", "CLOSED", "CANCELLED"];
const JOB_FETCH_CAP = 5000;

interface Filters {
  from: string | null;
  to: string | null;
  customerId?: string;
  siteId?: string;
  engineerId?: string;
  serviceTypeId?: string;
  status?: JobStatus;
}

export function parseFilters(sp: URLSearchParams): Filters {
  return {
    from: sp.get("from"),
    to: sp.get("to"),
    customerId: sp.get("customerId") || undefined,
    siteId: sp.get("siteId") || undefined,
    engineerId: sp.get("engineerId") || undefined,
    serviceTypeId: sp.get("serviceTypeId") || undefined,
    status: (sp.get("status") as JobStatus | null) || undefined,
  };
}

function dateRange(from: string | null, to: string | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };
}

function jobAnd(f: Filters, extra: Prisma.ServiceJobWhereInput[] = []): Prisma.ServiceJobWhereInput[] {
  const and: Prisma.ServiceJobWhereInput[] = [{ deletedAt: null }, ...extra];
  if (f.customerId) and.push({ customerId: f.customerId });
  if (f.siteId) and.push({ siteId: f.siteId });
  if (f.engineerId) and.push({ engineerId: f.engineerId });
  if (f.serviceTypeId) and.push({ serviceTypeId: f.serviceTypeId });
  if (f.status) and.push({ status: f.status });
  const dr = dateRange(f.from, f.to);
  if (dr) and.push({ requestDate: dr });
  return and;
}

async function fetchJobs(f: Filters, extra: Prisma.ServiceJobWhereInput[] = [], take = JOB_FETCH_CAP) {
  return prisma.serviceJob.findMany({
    where: { AND: jobAnd(f, extra) },
    orderBy: { requestDate: "desc" },
    take,
    select: {
      id: true, jobNumber: true, status: true, priority: true, progressPercent: true,
      requestDate: true, targetCompletionDate: true, completedAt: true,
      customerId: true, siteId: true, engineerId: true, serviceTypeId: true,
      customer: { select: { companyName: true } },
      site: { select: { name: true } },
      serviceType: { select: { name: true } },
      engineer: { select: { name: true } },
      equipment: { select: { name: true, amcStatus: true, amcValidUpto: true } },
    },
  });
}

type JobRow = Awaited<ReturnType<typeof fetchJobs>>[number];

function jobDetailColumns(): ReportColumn[] {
  return [
    { key: "jobNumber", label: "Job No." },
    { key: "customer", label: "Customer" },
    { key: "site", label: "Site" },
    { key: "serviceType", label: "Service Type" },
    { key: "engineer", label: "Engineer" },
    { key: "status", label: "Status" },
    { key: "requestDate", label: "Request Date" },
    { key: "targetDate", label: "Target Date" },
    { key: "progress", label: "Progress %", align: "right" },
  ];
}

function jobDetailRow(j: JobRow) {
  return {
    jobNumber: j.jobNumber,
    customer: j.customer.companyName,
    site: j.site.name,
    serviceType: j.serviceType.name,
    engineer: j.engineer?.name ?? "Unassigned",
    status: JOB_STATUS_LABELS[j.status] ?? j.status,
    requestDate: formatDate(j.requestDate),
    targetDate: formatDate(j.targetCompletionDate),
    progress: j.progressPercent,
  };
}

function bucketJobs<K extends string>(jobs: JobRow[], keyOf: (j: JobRow) => K, labelOf: (j: JobRow) => string) {
  const now = new Date();
  const map = new Map<K, { label: string; totalJobs: number; completed: number; open: number; overdue: number }>();
  for (const j of jobs) {
    const key = keyOf(j);
    const entry = map.get(key) ?? { label: labelOf(j), totalJobs: 0, completed: 0, open: 0, overdue: 0 };
    entry.totalJobs += 1;
    if (DONE_STATUSES.includes(j.status)) entry.completed += 1;
    else if (j.status !== "CANCELLED") entry.open += 1;
    if (j.targetCompletionDate && j.targetCompletionDate < now && !DONE_STATUSES.includes(j.status) && j.status !== "CANCELLED") {
      entry.overdue += 1;
    }
    map.set(key, entry);
  }
  return map;
}

export async function buildReport(reportKey: ReportKey, f: Filters): Promise<ReportResult> {
  switch (reportKey) {
    case "customer-wise": {
      const jobs = await fetchJobs(f);
      const map = bucketJobs(jobs, (j) => j.customerId, (j) => j.customer.companyName);
      const rows = [...map.entries()]
        .map(([, v]) => ({ customer: v.label, totalJobs: v.totalJobs, completed: v.completed, open: v.open, overdue: v.overdue }))
        .sort((a, b) => b.totalJobs - a.totalJobs);
      return {
        title: "Customer-wise Job Summary",
        description: "Total, completed, open and overdue jobs grouped by customer.",
        columns: [
          { key: "customer", label: "Customer" },
          { key: "totalJobs", label: "Total Jobs", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "open", label: "Open", align: "right" },
          { key: "overdue", label: "Overdue", align: "right" },
        ],
        rows,
        totals: rows.reduce(
          (t, r) => ({ totalJobs: (t.totalJobs as number) + r.totalJobs, completed: (t.completed as number) + r.completed, open: (t.open as number) + r.open, overdue: (t.overdue as number) + r.overdue }),
          { totalJobs: 0, completed: 0, open: 0, overdue: 0 } as Record<string, unknown>,
        ),
      };
    }
    case "site-wise": {
      const jobs = await fetchJobs(f);
      const map = bucketJobs(jobs, (j) => j.siteId, (j) => j.site.name);
      const customerBySite = new Map(jobs.map((j) => [j.siteId, j.customer.companyName]));
      const rows = [...map.entries()]
        .map(([id, v]) => ({ site: v.label, customer: customerBySite.get(id) ?? "—", totalJobs: v.totalJobs, completed: v.completed, open: v.open, overdue: v.overdue }))
        .sort((a, b) => b.totalJobs - a.totalJobs);
      return {
        title: "Site-wise Job Summary",
        description: "Total, completed, open and overdue jobs grouped by site.",
        columns: [
          { key: "site", label: "Site" },
          { key: "customer", label: "Customer" },
          { key: "totalJobs", label: "Total Jobs", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "open", label: "Open", align: "right" },
          { key: "overdue", label: "Overdue", align: "right" },
        ],
        rows,
      };
    }
    case "engineer-wise": {
      const jobs = await fetchJobs(f);
      const map = bucketJobs(jobs, (j) => j.engineerId ?? "unassigned", (j) => j.engineer?.name ?? "Unassigned");
      const rows = [...map.entries()]
        .map(([, v]) => ({ engineer: v.label, totalJobs: v.totalJobs, completed: v.completed, open: v.open, overdue: v.overdue }))
        .sort((a, b) => b.totalJobs - a.totalJobs);
      return {
        title: "Engineer-wise Job Summary",
        description: "Workload and completion split by assigned engineer.",
        columns: [
          { key: "engineer", label: "Engineer" },
          { key: "totalJobs", label: "Total Jobs", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "open", label: "Open", align: "right" },
          { key: "overdue", label: "Overdue", align: "right" },
        ],
        rows,
      };
    }
    case "service-wise": {
      const jobs = await fetchJobs(f);
      const map = bucketJobs(jobs, (j) => j.serviceTypeId, (j) => j.serviceType.name);
      const rows = [...map.entries()]
        .map(([, v]) => ({ serviceType: v.label, totalJobs: v.totalJobs, completed: v.completed, open: v.open }))
        .sort((a, b) => b.totalJobs - a.totalJobs);
      return {
        title: "Service Type-wise Summary",
        description: "Jobs grouped by the type of service performed.",
        columns: [
          { key: "serviceType", label: "Service Type" },
          { key: "totalJobs", label: "Total Jobs", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
          { key: "open", label: "Open", align: "right" },
        ],
        rows,
      };
    }
    case "date-wise": {
      const extra: Prisma.ServiceJobWhereInput[] = f.from || f.to ? [] : [{ requestDate: { gte: new Date(Date.now() - 29 * 86_400_000) } }];
      const jobs = await fetchJobs(f, extra);
      const map = new Map<string, { date: string; jobsCreated: number; completed: number }>();
      for (const j of jobs) {
        const key = formatDate(j.requestDate);
        const entry = map.get(key) ?? { date: key, jobsCreated: 0, completed: 0 };
        entry.jobsCreated += 1;
        if (DONE_STATUSES.includes(j.status)) entry.completed += 1;
        map.set(key, entry);
      }
      const rows = [...map.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return {
        title: "Date-wise Job Activity",
        description: "Jobs raised per day (defaults to the last 30 days when no date range is set).",
        columns: [
          { key: "date", label: "Date" },
          { key: "jobsCreated", label: "Jobs Raised", align: "right" },
          { key: "completed", label: "Completed", align: "right" },
        ],
        rows,
      };
    }
    case "job-wise": {
      const jobs = await fetchJobs(f);
      return {
        title: "Job-wise Detail",
        description: "Every service job matching the current filters.",
        columns: jobDetailColumns(),
        rows: jobs.map(jobDetailRow),
        totals: { count: jobs.length },
      };
    }
    case "pending-jobs": {
      const jobs = await fetchJobs(f, [{ status: { notIn: OPEN_EXCLUDE } }]);
      return {
        title: "Pending / Open Jobs",
        description: "Jobs that have not yet been completed, closed or cancelled.",
        columns: jobDetailColumns(),
        rows: jobs.map(jobDetailRow),
        totals: { count: jobs.length },
      };
    }
    case "completed-jobs": {
      const jobs = await fetchJobs(f, [{ status: { in: DONE_STATUSES } }]);
      return {
        title: "Completed Jobs",
        description: "Jobs marked completed or closed.",
        columns: jobDetailColumns(),
        rows: jobs.map(jobDetailRow),
        totals: { count: jobs.length },
      };
    }
    case "amc": {
      const jobs = await fetchJobs(f, [{
        OR: [
          { serviceType: { name: { contains: "AMC", mode: "insensitive" } } },
          { equipment: { amcStatus: "UNDER_AMC" } },
        ],
      }]);
      return {
        title: "AMC Jobs",
        description: "Jobs against an AMC service type or equipment currently under AMC.",
        columns: [...jobDetailColumns(), { key: "equipment", label: "Equipment" }, { key: "amcUpto", label: "AMC Valid Upto" }],
        rows: jobs.map((j) => ({ ...jobDetailRow(j), equipment: j.equipment?.name ?? "—", amcUpto: formatDate(j.equipment?.amcValidUpto) })),
        totals: { count: jobs.length },
      };
    }
    case "breakdown": {
      const jobs = await fetchJobs(f, [{ serviceType: { name: { contains: "Breakdown", mode: "insensitive" } } }]);
      return {
        title: "Breakdown Service Jobs",
        description: "Jobs raised for breakdown / emergency service.",
        columns: jobDetailColumns(),
        rows: jobs.map(jobDetailRow),
        totals: { count: jobs.length },
      };
    }
    case "mom-pending": {
      const and: Prisma.MomWhereInput[] = [{ deletedAt: null, status: { in: ["DRAFT", "SUBMITTED"] } }];
      if (f.customerId) and.push({ customerId: f.customerId });
      if (f.siteId) and.push({ siteId: f.siteId });
      if (f.engineerId || f.serviceTypeId) {
        and.push({ job: { ...(f.engineerId ? { engineerId: f.engineerId } : {}), ...(f.serviceTypeId ? { serviceTypeId: f.serviceTypeId } : {}) } });
      }
      const dr = dateRange(f.from, f.to);
      if (dr) and.push({ meetingDate: dr });
      const moms = await prisma.mom.findMany({
        where: { AND: and },
        orderBy: { meetingDate: "desc" },
        take: JOB_FETCH_CAP,
        select: {
          id: true, momNumber: true, meetingDate: true, status: true,
          customer: { select: { companyName: true } }, site: { select: { name: true } }, job: { select: { jobNumber: true } },
        },
      });
      return {
        title: "MOM Pending Finalisation",
        description: "Minutes of Meeting still in Draft or Submitted status.",
        columns: [
          { key: "momNumber", label: "MOM No." },
          { key: "customer", label: "Customer" },
          { key: "site", label: "Site" },
          { key: "jobNumber", label: "Job No." },
          { key: "meetingDate", label: "Meeting Date" },
          { key: "status", label: "Status" },
        ],
        rows: moms.map((m) => ({
          momNumber: m.momNumber, customer: m.customer.companyName, site: m.site.name,
          jobNumber: m.job.jobNumber, meetingDate: formatDate(m.meetingDate), status: m.status,
        })),
        totals: { count: moms.length },
      };
    }
    case "confirmation-pending": {
      const and: Prisma.ClientConfirmationWhereInput[] = [{ status: "PENDING" }];
      if (f.customerId) and.push({ customerId: f.customerId });
      const dr = dateRange(f.from, f.to);
      if (dr) and.push({ createdAt: dr });
      const confirmations = await prisma.clientConfirmation.findMany({
        where: { AND: and }, orderBy: { createdAt: "asc" }, take: JOB_FETCH_CAP,
      });
      const customerIds = [...new Set(confirmations.map((c) => c.customerId))];
      const customers = customerIds.length
        ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, companyName: true } })
        : [];
      const nameById = new Map(customers.map((c) => [c.id, c.companyName]));
      return {
        title: "Client Confirmations Pending",
        description: "Documents sent to the client that are still awaiting confirmation.",
        columns: [
          { key: "recordNumber", label: "Record No." },
          { key: "docType", label: "Document Type" },
          { key: "customer", label: "Customer" },
          { key: "sentOn", label: "Sent On" },
          { key: "status", label: "Status" },
        ],
        rows: confirmations.map((c) => ({
          recordNumber: c.recordNumber,
          docType: DOC_TYPE_LABELS[c.docType] ?? c.docType,
          customer: c.clientName ?? nameById.get(c.customerId) ?? "—",
          sentOn: formatDate(c.createdAt),
          status: c.status,
        })),
        totals: { count: confirmations.length },
      };
    }
    case "material-usage": {
      const jobFilter: Prisma.ServiceJobWhereInput = {
        ...(f.customerId ? { customerId: f.customerId } : {}),
        ...(f.siteId ? { siteId: f.siteId } : {}),
        ...(f.engineerId ? { engineerId: f.engineerId } : {}),
        ...(f.serviceTypeId ? { serviceTypeId: f.serviceTypeId } : {}),
      };
      const dr = dateRange(f.from, f.to);
      const materials = await prisma.workMaterial.findMany({
        where: { dailyReport: { deletedAt: null, ...(dr ? { reportDate: dr } : {}), job: jobFilter } },
        take: JOB_FETCH_CAP,
        select: { name: true, quantity: true, unit: true },
      });
      const map = new Map<string, { name: string; timesUsed: number; totalQuantity: number; units: Set<string> }>();
      for (const m of materials) {
        const entry = map.get(m.name) ?? { name: m.name, timesUsed: 0, totalQuantity: 0, units: new Set<string>() };
        entry.timesUsed += 1;
        entry.totalQuantity += m.quantity;
        if (m.unit) entry.units.add(m.unit);
        map.set(m.name, entry);
      }
      const rows = [...map.values()]
        .map((v) => ({ material: v.name, timesUsed: v.timesUsed, totalQuantity: v.totalQuantity, unit: [...v.units].join(", ") || "—" }))
        .sort((a, b) => b.timesUsed - a.timesUsed);
      return {
        title: "Material Usage",
        description: "Materials recorded on daily work reports, aggregated across matching jobs.",
        columns: [
          { key: "material", label: "Material" },
          { key: "timesUsed", label: "Times Used", align: "right" },
          { key: "totalQuantity", label: "Total Quantity", align: "right" },
          { key: "unit", label: "Unit" },
        ],
        rows,
      };
    }
    case "spare-usage": {
      const jobFilter: Prisma.ServiceJobWhereInput = {
        ...(f.customerId ? { customerId: f.customerId } : {}),
        ...(f.siteId ? { siteId: f.siteId } : {}),
        ...(f.engineerId ? { engineerId: f.engineerId } : {}),
        ...(f.serviceTypeId ? { serviceTypeId: f.serviceTypeId } : {}),
      };
      const dr = dateRange(f.from, f.to);
      const spares = await prisma.workSpare.findMany({
        where: { dailyReport: { deletedAt: null, ...(dr ? { reportDate: dr } : {}), job: jobFilter } },
        take: JOB_FETCH_CAP,
        select: { name: true, partNumber: true, quantity: true, unit: true },
      });
      const map = new Map<string, { name: string; partNumber: string; timesUsed: number; totalQuantity: number; units: Set<string> }>();
      for (const s of spares) {
        const key = `${s.name}::${s.partNumber ?? ""}`;
        const entry = map.get(key) ?? { name: s.name, partNumber: s.partNumber ?? "—", timesUsed: 0, totalQuantity: 0, units: new Set<string>() };
        entry.timesUsed += 1;
        entry.totalQuantity += s.quantity;
        if (s.unit) entry.units.add(s.unit);
        map.set(key, entry);
      }
      const rows = [...map.values()]
        .map((v) => ({ spare: v.name, partNumber: v.partNumber, timesUsed: v.timesUsed, totalQuantity: v.totalQuantity, unit: [...v.units].join(", ") || "—" }))
        .sort((a, b) => b.timesUsed - a.timesUsed);
      return {
        title: "Spare Parts Usage",
        description: "Spare parts recorded on daily work reports, aggregated across matching jobs.",
        columns: [
          { key: "spare", label: "Spare" },
          { key: "partNumber", label: "Part No." },
          { key: "timesUsed", label: "Times Used", align: "right" },
          { key: "totalQuantity", label: "Total Quantity", align: "right" },
          { key: "unit", label: "Unit" },
        ],
        rows,
      };
    }
    case "work-hours": {
      const jobFilter: Prisma.ServiceJobWhereInput = {
        ...(f.customerId ? { customerId: f.customerId } : {}),
        ...(f.siteId ? { siteId: f.siteId } : {}),
        ...(f.engineerId ? { engineerId: f.engineerId } : {}),
        ...(f.serviceTypeId ? { serviceTypeId: f.serviceTypeId } : {}),
      };
      const dr = dateRange(f.from, f.to);
      const reports = await prisma.dailyWorkReport.findMany({
        where: { deletedAt: null, ...(dr ? { reportDate: dr } : {}), job: jobFilter },
        take: JOB_FETCH_CAP,
        select: { workHours: true, engineerId: true, engineer: { select: { name: true } } },
      });
      const map = new Map<string, { name: string; reports: number; totalHours: number }>();
      for (const r of reports) {
        const key = r.engineerId ?? "unassigned";
        const entry = map.get(key) ?? { name: r.engineer?.name ?? "Unassigned", reports: 0, totalHours: 0 };
        entry.reports += 1;
        entry.totalHours += r.workHours ?? 0;
        map.set(key, entry);
      }
      const rows = [...map.values()]
        .map((v) => ({ engineer: v.name, reports: v.reports, totalHours: Math.round(v.totalHours * 10) / 10, avgHours: v.reports ? Math.round((v.totalHours / v.reports) * 10) / 10 : 0 }))
        .sort((a, b) => b.totalHours - a.totalHours);
      return {
        title: "Work Hours by Engineer",
        description: "Recorded work hours from daily work reports, grouped by engineer.",
        columns: [
          { key: "engineer", label: "Engineer" },
          { key: "reports", label: "Reports", align: "right" },
          { key: "totalHours", label: "Total Hours", align: "right" },
          { key: "avgHours", label: "Avg Hours / Report", align: "right" },
        ],
        rows,
      };
    }
    default: {
      const _exhaustive: never = reportKey;
      throw Errors.validation(`Unknown report: ${_exhaustive}`);
    }
  }
}
