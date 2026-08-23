"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, LinkButton } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_TONE } from "@/lib/ui";
import { DOC_STATUS_LABELS } from "@/lib/masters";

interface StaffOption {
  id: string;
  name: string;
}

interface DailyReportRow {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  workHours: number | null;
  progressPercent: number;
  job: { id: string; jobNumber: string; customer: { id: string; companyName: string }; site: { id: string; name: string } };
  engineer: { id: string; name: string } | null;
}

const QUICK_CHIPS: { key: string; label: string; status: string }[] = [
  { key: "draft", label: "Draft", status: "DRAFT" },
  { key: "awaiting", label: "Awaiting confirmation", status: "CONFIRMATION_PENDING" },
  { key: "confirmed", label: "Confirmed", status: "CLIENT_CONFIRMED" },
];

export default function DailyReportsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  useEffect(() => {
    api.get<StaffOption[]>("/api/staff/options").then(setStaff).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<DailyReportRow>(`/api/daily-reports${qs({ q, status, engineerId, from, to, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load daily work reports", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, engineerId, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<DailyReportRow>[] = [
    { key: "report", header: "Report No.", cell: (r) => <span className="font-semibold">{r.reportNumber}</span> },
    { key: "job", header: "Job No.", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.job.jobNumber}</span> },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <span>
          <span className="block">{r.job.customer.companyName}</span>
          <span className="block text-xs text-slate-500">{r.job.site.name}</span>
        </span>
      ),
    },
    { key: "date", header: "Date", cell: (r) => <span className="text-slate-600">{formatDate(r.reportDate)}</span> },
    { key: "engineer", header: "Engineer", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.engineer?.name ?? "—"}</span> },
    { key: "hours", header: "Hours", align: "center", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.workHours ?? "—"}</span> },
    { key: "progress", header: "Progress %", align: "center", cell: (r) => <span className="text-slate-600">{r.progressPercent}%</span> },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={DOC_STATUS_TONE[r.status]}>{DOC_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  const activeFilters = [status, engineerId, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Daily Work Reports"
        description="A day-by-day record of the work carried out on each service job."
        crumbs={[{ label: "Daily Work Reports" }]}
        actions={
          <LinkButton href="/daily-reports/new">
            <Plus className="h-4 w-4" /> New Daily Report
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {QUICK_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => { setStatus((s) => (s === c.status ? "" : c.status)); setPage(1); }}
            className={clsx(
              "te-focus rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === c.status
                ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => { setStatus(""); setEngineerId(""); setFrom(""); setTo(""); setPage(1); }}
          >
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search report no., job no., customer, site…" />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={Object.entries(DOC_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Engineer"
              value={engineerId}
              onChange={(v) => { setEngineerId(v); setPage(1); }}
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              allLabel="All engineers"
            />
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              aria-label="From date"
              className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              aria-label="To date"
              className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
            />
          </FilterBar>
        </div>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            meta={meta}
            onPageChange={setPage}
            rowHref={(r) => `/daily-reports/${r.id}`}
            emptyTitle={q || activeFilters ? "No reports match your filters" : "No daily work reports yet"}
            emptyDescription={q || activeFilters ? "Try a different search term or clear the filters." : "Create a daily work report from a service job to start tracking progress."}
            emptyAction={!q && !activeFilters ? <LinkButton href="/daily-reports/new"><Plus className="h-4 w-4" /> New Daily Report</LinkButton> : undefined}
          />
        </div>
      </Card>
    </>
  );
}
