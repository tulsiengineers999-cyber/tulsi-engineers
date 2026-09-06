"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2, MapPin, Cog, ClipboardList, PlayCircle, CalendarClock, CalendarCheck,
  FileWarning, BadgeAlert, FileClock, UserCheck2, AlertTriangle, CheckCircle2,
  ShieldCheck, Flame, ArrowRight, Inbox,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, EmptyState, Spinner } from "@/components/ui/primitives";
import { FilterBar, FilterSelect } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime, formatNumber, relativeDate } from "@/lib/format";
import { JOB_STATUS_LABELS, DOC_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/masters";
import { JOB_STATUS_TONE, CONFIRMATION_TONE } from "@/lib/ui";
import type { BadgeTone } from "@/components/ui/primitives";

/* ── Chart palette — validated with the dataviz skill's contrast/CVD checks
   against the app's white chart surface. Single-hue bars use the brand color
   directly; multi-series charts use the validated categorical triplet. ── */
const CHART = {
  primary: "#e52b1a",
  accent: "#111111",
  grid: "#e2e8f0",
  axis: "#94a3b8",
  series: { jobs: "#e52b1a", visits: "#111111", reports: "#b51f14" },
  workload: { open: "#e52b1a", completed: "#111111" },
  status: { PENDING: "#b45309", CONFIRMED: "#15803d", CORRECTION_REQUESTED: "#e52b1a", EXPIRED: "#94a3b8" },
};

const CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CORRECTION_REQUESTED: "Correction Requested",
  EXPIRED: "Expired",
};

/* ── API response types ─────────────────────────────────────────────── */

interface DashboardCards {
  totalCustomers: number;
  totalSites: number;
  totalEquipment: number;
  openJobs: number;
  todaysVisits: number;
  upcomingVisits: number;
  pendingMom: number;
  momConfirmationPending: number;
  activeJobs: number;
  dailyReportsPending: number;
  clientConfirmationsPending: number;
  completedJobs: number;
  overdueJobs: number;
  amcJobs: number;
  breakdownJobs: number;
}

interface DashboardResponse {
  cards: DashboardCards;
  charts: {
    jobsByStatus: { status: string; label: string; count: number }[];
    jobsByServiceType: { serviceTypeId: string; name: string; count: number }[];
    engineerWorkload: { engineerId: string; name: string; open: number; completed: number }[];
    monthlyActivity: { month: string; jobs: number; visits: number; reports: number }[];
    confirmationStatus: { status: string; count: number }[];
  };
  lists: {
    recentJobs: { id: string; jobNumber: string; status: string; createdAt: string; customerName: string; siteName: string; serviceTypeName: string; engineerName: string | null }[];
    todaysVisitsList: { id: string; visitNumber: string; visitDate: string; arrivalTime: string | null; customerName: string; siteName: string; engineerName: string | null }[];
    pendingConfirmations: { id: string; recordNumber: string; docType: string; customerName: string; createdAt: string; href: string }[];
    overdueActionPoints: { id: string; actionPoint: string; dueDate: string | null; priority: string; momId: string; momNumber: string; customerName: string; siteName: string }[];
  };
}

interface CustomerOption { id: string; code: string; companyName: string }
interface StaffOption { id: string; name: string; isEngineer: boolean; isTechnician: boolean }
interface ServiceTypeOption { id: string; name: string }

/* ── KPI card ────────────────────────────────────────────────────────── */

function KpiCard({
  label, value, hint, icon: Icon, href, tone = "primary",
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ElementType;
  href: string;
  tone?: "primary" | "accent" | "success" | "warning" | "danger" | "neutral";
}) {
  const TONE: Record<string, { bar: string; iconBg: string; iconFg: string }> = {
    primary: { bar: "bg-[var(--te-primary)]", iconBg: "bg-[var(--te-primary-light)]", iconFg: "text-[var(--te-primary)]" },
    accent: { bar: "bg-[var(--te-accent)]", iconBg: "bg-[var(--te-accent-light)]", iconFg: "text-[var(--te-accent)]" },
    success: { bar: "bg-green-600", iconBg: "bg-green-50", iconFg: "text-green-700" },
    warning: { bar: "bg-amber-500", iconBg: "bg-amber-50", iconFg: "text-amber-700" },
    danger: { bar: "bg-red-600", iconBg: "bg-red-50", iconFg: "text-red-700" },
    neutral: { bar: "bg-slate-400", iconBg: "bg-slate-100", iconFg: "text-slate-500" },
  };
  const c = TONE[tone];
  return (
    <Link
      href={href}
      className="te-focus group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${c.bar}`} />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${c.iconBg} ${c.iconFg}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <ArrowRight className="absolute right-3 bottom-3 h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function GroupHeading({ children, tone }: { children: React.ReactNode; tone?: "warning" }) {
  return (
    <h2
      className={`mb-2.5 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase ${
        tone === "warning" ? "text-amber-700" : "text-slate-500"
      }`}
    >
      {tone === "warning" && <AlertTriangle className="h-3.5 w-3.5" />}
      {children}
    </h2>
  );
}

/* ── Chart tooltip / axis chrome shared across charts ───────────────── */

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.08)" },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
  cursor: { fill: "rgba(15,76,129,0.06)" },
};

function ChartCard({ title, description, children, empty }: { title: string; description?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card title={title} description={description} bodyClassName="pt-2">
      {empty ? (
        <EmptyState icon={Inbox} title="Not enough data yet" description="This chart will fill in as jobs, visits and reports are recorded." />
      ) : (
        <div className="h-72 w-full">{children}</div>
      )}
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [engineers, setEngineers] = useState<StaffOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
    api.get<StaffOption[]>("/api/staff/options").then(setEngineers).catch(() => undefined);
    api.get<ServiceTypeOption[]>("/api/service-types/options").then(setServiceTypes).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardResponse>(
        `/api/dashboard${qs({ from, to, customerId, engineerId, serviceTypeId, status })}`,
      );
      setData(res);
    } catch (err) {
      toast.error("Could not load the dashboard", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [from, to, customerId, engineerId, serviceTypeId, status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFilters = [from, to, customerId, engineerId, serviceTypeId, status].filter(Boolean).length;
  const engineerOptions = useMemo(() => engineers.filter((e) => e.isEngineer || e.isTechnician), [engineers]);

  const c = data?.cards;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live overview of service jobs, visits, reports and client confirmations."
        crumbs={[{ label: "Dashboard" }]}
      />

      <Card bodyClassName="p-0 sm:p-0" className="mb-5">
        <div className="p-4 sm:p-5">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => { setFrom(""); setTo(""); setCustomerId(""); setEngineerId(""); setServiceTypeId(""); setStatus(""); }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date"
                className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date"
                className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
              />
            </div>
            <FilterSelect label="Customer" value={customerId} onChange={setCustomerId} allLabel="All customers"
              options={customers.map((cu) => ({ value: cu.id, label: cu.companyName }))} />
            <FilterSelect label="Engineer" value={engineerId} onChange={setEngineerId} allLabel="All engineers"
              options={engineerOptions.map((e) => ({ value: e.id, label: e.name }))} />
            <FilterSelect label="Service type" value={serviceTypeId} onChange={setServiceTypeId} allLabel="All service types"
              options={serviceTypes.map((s) => ({ value: s.id, label: s.name }))} />
            <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="All statuses"
              options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          </FilterBar>
        </div>
      </Card>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Spinner /> Loading dashboard…
        </div>
      ) : !c ? null : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Masters */}
          <div className="mb-6">
            <GroupHeading>Masters</GroupHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard label="Customers" value={c.totalCustomers} icon={Building2} href="/customers" hint="Active customer accounts" />
              <KpiCard label="Sites" value={c.totalSites} icon={MapPin} href="/sites" hint="Registered service locations" />
              <KpiCard label="Equipment" value={c.totalEquipment} icon={Cog} href="/equipment" hint="Boilers, heaters and accessories" />
            </div>
          </div>

          {/* Work in progress */}
          <div className="mb-6">
            <GroupHeading>Work in progress</GroupHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Open jobs" value={c.openJobs} icon={ClipboardList} href="/jobs?status=NEW,ASSIGNED,SITE_VISIT,MOM_CREATED,WORK_STARTED,WORK_IN_PROGRESS,CONFIRMATION_PENDING" hint="Not yet completed" />
              <KpiCard label="Active jobs" value={c.activeJobs} icon={PlayCircle} href="/jobs?status=WORK_STARTED,WORK_IN_PROGRESS" tone="accent" hint="Work currently underway" />
              <KpiCard label="Today's visits" value={c.todaysVisits} icon={CalendarClock} href="/visits" hint="Scheduled for today" />
              <KpiCard label="Upcoming visits" value={c.upcomingVisits} icon={CalendarCheck} href="/visits" hint="Next 7 days" />
            </div>
          </div>

          {/* Needs attention */}
          <div className="mb-6">
            <GroupHeading tone="warning">Needs attention</GroupHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Pending MOM" value={c.pendingMom} icon={FileWarning} href="/mom?status=DRAFT,SUBMITTED" tone="warning" hint="Draft or submitted" />
              <KpiCard label="MOM confirmation pending" value={c.momConfirmationPending} icon={BadgeAlert} href="/mom?status=CONFIRMATION_PENDING" tone="warning" hint="Sent, awaiting client" />
              <KpiCard label="Daily reports pending" value={c.dailyReportsPending} icon={FileClock} href="/daily-reports?status=SUBMITTED" tone="warning" hint="Submitted, not yet sent" />
              <KpiCard label="Confirmations pending" value={c.clientConfirmationsPending} icon={UserCheck2} href="/confirmations" tone="warning" hint="Awaiting client sign-off" />
              <KpiCard label="Overdue jobs" value={c.overdueJobs} icon={AlertTriangle} href="/jobs?overdue=1" tone="danger" hint="Past the target date" />
            </div>
          </div>

          {/* Completed & contracts */}
          <div className="mb-6">
            <GroupHeading>Completed &amp; contracts</GroupHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard label="Completed jobs" value={c.completedJobs} icon={CheckCircle2} href="/jobs?status=COMPLETED,CLOSED" tone="success" hint="Completed or closed" />
              <KpiCard label="AMC jobs" value={c.amcJobs} icon={ShieldCheck} href="/jobs?amc=1" tone="primary" hint="Under an active AMC" />
              <KpiCard label="Breakdown jobs" value={c.breakdownJobs} icon={Flame} href="/jobs" tone="accent" hint="Emergency / breakdown service" />
            </div>
          </div>

          {/* Charts */}
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Jobs by status" description="Where every open and closed job currently stands." empty={!data.charts.jobsByStatus.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.jobsByStatus} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke={CHART.grid} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "#334155" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [formatNumber(Number(v)), "Jobs"]} />
                  <Bar dataKey="count" name="Jobs" fill={CHART.primary} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Jobs by service type" description="Top 8 service types by job count." empty={!data.charts.jobsByServiceType.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.jobsByServiceType} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} width={32} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [formatNumber(Number(v)), "Jobs"]} />
                  <Bar dataKey="count" name="Jobs" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Engineer workload" description="Open vs. completed jobs per engineer." empty={!data.charts.engineerWorkload.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.engineerWorkload} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="open" name="Open" stackId="jobs" fill={CHART.workload.open} radius={[0, 0, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="completed" name="Completed" stackId="jobs" fill={CHART.workload.completed} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Client confirmation status" description="Where sent documents stand with the client." empty={!data.charts.confirmationStatus.length}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...tooltipStyle} formatter={(v: any, n: any) => [formatNumber(Number(v)), n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                  <Pie
                    data={data.charts.confirmationStatus.map((s) => ({ ...s, label: CONFIRMATION_STATUS_LABELS[s.status] ?? s.status }))}
                    dataKey="count" nameKey="label" innerRadius={56} outerRadius={84} paddingAngle={2} strokeWidth={2} stroke="#ffffff"
                  >
                    {data.charts.confirmationStatus.map((s) => (
                      <Cell key={s.status} fill={CHART.status[s.status as keyof typeof CHART.status] ?? CHART.axis} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="lg:col-span-2">
              <ChartCard title="Monthly service activity" description="Jobs raised, site visits and reports over the last 12 months." empty={!data.charts.monthlyActivity.some((m) => m.jobs || m.visits || m.reports)}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.monthlyActivity} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} width={32} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                    <Area type="monotone" dataKey="jobs" name="Jobs" stroke={CHART.series.jobs} fill={CHART.series.jobs} fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="visits" name="Visits" stroke={CHART.series.visits} fill={CHART.series.visits} fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="reports" name="Reports" stroke={CHART.series.reports} fill={CHART.series.reports} fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Recent jobs" bodyClassName={data.lists.recentJobs.length ? "p-0" : undefined}>
              {data.lists.recentJobs.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No service jobs yet" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.lists.recentJobs.map((j) => (
                    <li key={j.id}>
                      <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{j.jobNumber}</span>
                          <span className="block truncate text-xs text-slate-500">{j.customerName} · {j.siteName} · {j.serviceTypeName}</span>
                        </span>
                        <Badge tone={JOB_STATUS_TONE[j.status] as BadgeTone}>{JOB_STATUS_LABELS[j.status] ?? j.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Today's visits" bodyClassName={data.lists.todaysVisitsList.length ? "p-0" : undefined}>
              {data.lists.todaysVisitsList.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No visits scheduled for today" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.lists.todaysVisitsList.map((v) => (
                    <li key={v.id}>
                      <Link href={`/visits/${v.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{v.visitNumber}</span>
                          <span className="block truncate text-xs text-slate-500">{v.customerName} · {v.siteName}{v.engineerName ? ` · ${v.engineerName}` : ""}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-500">{v.arrivalTime ?? formatDate(v.visitDate)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Pending client confirmations" bodyClassName={data.lists.pendingConfirmations.length ? "p-0" : undefined}>
              {data.lists.pendingConfirmations.length === 0 ? (
                <EmptyState icon={UserCheck2} title="Nothing awaiting client confirmation" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.lists.pendingConfirmations.map((p) => (
                    <li key={p.id}>
                      <Link href={p.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{p.recordNumber}</span>
                          <span className="block truncate text-xs text-slate-500">{DOC_TYPE_LABELS[p.docType] ?? p.docType} · {p.customerName}</span>
                        </span>
                        <Badge tone={CONFIRMATION_TONE.PENDING}>{relativeDate(p.createdAt)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Overdue action points" bodyClassName={data.lists.overdueActionPoints.length ? "p-0" : undefined}>
              {data.lists.overdueActionPoints.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No overdue action points" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.lists.overdueActionPoints.map((a) => (
                    <li key={a.id}>
                      <Link href={`/mom/${a.momId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{a.actionPoint}</span>
                          <span className="block truncate text-xs text-slate-500">{a.momNumber} · {a.customerName} · {a.siteName}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Badge tone="danger">{PRIORITY_LABELS[a.priority] ?? a.priority}</Badge>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{formatDateTime(a.dueDate)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
