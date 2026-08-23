"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Printer, FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, LinkButton, EmptyState, Spinner } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { JOB_STATUS_LABELS } from "@/lib/masters";
import { formatNumber } from "@/lib/format";

interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

interface ReportResult {
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
}

interface CustomerOption { id: string; code: string; companyName: string }
interface SiteOption { id: string; name: string; customerId: string }
interface StaffOption { id: string; name: string; isEngineer: boolean; isTechnician: boolean }
interface ServiceTypeOption { id: string; name: string }

const REPORT_GROUPS: { group: string; reports: { key: string; label: string }[] }[] = [
  {
    group: "Jobs",
    reports: [
      { key: "customer-wise", label: "Customer-wise" },
      { key: "site-wise", label: "Site-wise" },
      { key: "engineer-wise", label: "Engineer-wise" },
      { key: "service-wise", label: "Service type-wise" },
      { key: "date-wise", label: "Date-wise" },
      { key: "job-wise", label: "Job-wise detail" },
      { key: "pending-jobs", label: "Pending jobs" },
      { key: "completed-jobs", label: "Completed jobs" },
      { key: "amc", label: "AMC jobs" },
      { key: "breakdown", label: "Breakdown jobs" },
    ],
  },
  {
    group: "Documents",
    reports: [
      { key: "mom-pending", label: "MOM pending" },
      { key: "confirmation-pending", label: "Confirmation pending" },
    ],
  },
  {
    group: "Usage",
    reports: [
      { key: "material-usage", label: "Material usage" },
      { key: "spare-usage", label: "Spare parts usage" },
      { key: "work-hours", label: "Work hours by engineer" },
    ],
  },
];

export default function AnalyticsPage() {
  const toast = useToast();
  const [reportKey, setReportKey] = useState("customer-wise");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [engineers, setEngineers] = useState<StaffOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
    api.get<StaffOption[]>("/api/staff/options").then(setEngineers).catch(() => undefined);
    api.get<ServiceTypeOption[]>("/api/service-types/options").then(setServiceTypes).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.get<SiteOption[]>(`/api/sites/options${qs({ customerId })}`).then(setSites).catch(() => undefined);
  }, [customerId]);

  const filterQuery = useMemo(
    () => ({ report: reportKey, from, to, customerId, siteId, engineerId, serviceTypeId, status }),
    [reportKey, from, to, customerId, siteId, engineerId, serviceTypeId, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ReportResult>(`/api/analytics${qs(filterQuery)}`);
      setResult(res);
    } catch (err) {
      toast.error("Could not load this report", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [filterQuery, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const engineerOptions = useMemo(() => engineers.filter((e) => e.isEngineer || e.isTechnician), [engineers]);
  const activeFilters = [from, to, customerId, siteId, engineerId, serviceTypeId, status].filter(Boolean).length;

  const columns: Column<{ id: string } & Record<string, unknown>>[] = (result?.columns ?? []).map((c) => ({
    key: c.key,
    header: c.label,
    align: c.align,
    cell: (row) => {
      const value = row[c.key];
      if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
      if (typeof value === "number") return <span>{formatNumber(value)}</span>;
      return <span>{String(value)}</span>;
    },
  }));

  const rows = (result?.rows ?? []).map((r, i) => ({ id: String(i), ...r }));

  const exportUrl = (format: "xlsx" | "csv") => `/api/analytics/export${qs({ ...filterQuery, format })}`;

  return (
    <>
      <PageHeader
        title="Reports &amp; Analytics"
        description="Every service metric, sliced by customer, site, engineer or time."
        crumbs={[{ label: "Reports & Analytics" }]}
      />

      <div className="hidden print:mb-4 print:block">
        <p className="text-lg font-bold text-slate-900">TULSI ENGINEERS</p>
        {result && <p className="text-sm text-slate-600">{result.title} — generated {new Date().toLocaleString("en-IN")}</p>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="no-print space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start">
          {REPORT_GROUPS.map((g) => (
            <div key={g.group}>
              <p className="mb-1.5 px-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{g.group}</p>
              <ul className="space-y-0.5">
                {g.reports.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => setReportKey(r.key)}
                      className={clsx(
                        "te-focus block w-full rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                        reportKey === r.key
                          ? "bg-[var(--te-primary-light)] text-[var(--te-primary)]"
                          : "text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          <Card bodyClassName="p-0 sm:p-0" className="mb-4 no-print">
            <div className="p-4 sm:p-5">
              <FilterBar
                activeCount={activeFilters}
                onReset={() => { setFrom(""); setTo(""); setCustomerId(""); setSiteId(""); setEngineerId(""); setServiceTypeId(""); setStatus(""); }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date"
                    className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date"
                    className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600" />
                </div>
                <FilterSelect label="Customer" value={customerId} onChange={(v) => { setCustomerId(v); setSiteId(""); }} allLabel="All customers"
                  options={customers.map((c) => ({ value: c.id, label: c.companyName }))} />
                <FilterSelect label="Site" value={siteId} onChange={setSiteId} allLabel="All sites"
                  options={sites.map((s) => ({ value: s.id, label: s.name }))} />
                <FilterSelect label="Engineer" value={engineerId} onChange={setEngineerId} allLabel="All engineers"
                  options={engineerOptions.map((e) => ({ value: e.id, label: e.name }))} />
                <FilterSelect label="Service type" value={serviceTypeId} onChange={setServiceTypeId} allLabel="All service types"
                  options={serviceTypes.map((s) => ({ value: s.id, label: s.name }))} />
                <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="All statuses"
                  options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
              </FilterBar>
            </div>
          </Card>

          <Card
            title={result?.title ?? "Report"}
            description={result?.description}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" /> Export as PDF
                </Button>
                <LinkButton href={exportUrl("xlsx")} variant="outline" size="sm" prefetch={false}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </LinkButton>
                <LinkButton href={exportUrl("csv")} variant="outline" size="sm" prefetch={false}>
                  <FileText className="h-3.5 w-3.5" /> CSV
                </LinkButton>
              </>
            }
            bodyClassName={rows.length ? "p-0" : undefined}
          >
            {loading && !result ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Spinner /> Loading report…
              </div>
            ) : !result || rows.length === 0 ? (
              <EmptyState icon={BarChart3} title="No data for this report" description="Try widening the date range or clearing a filter." />
            ) : (
              <>
                <div className="px-4 pt-4 sm:px-5">
                  <DataTable columns={columns} rows={rows} />
                </div>
                {result.totals && (
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:px-5">
                    {Object.entries(result.totals).map(([key, value]) => {
                      const label = result.columns.find((c) => c.key === key)?.label ?? key;
                      return (
                        <span key={key} className="font-medium text-slate-600">
                          {label}: <span className="font-bold text-slate-900">{typeof value === "number" ? formatNumber(value) : String(value)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
