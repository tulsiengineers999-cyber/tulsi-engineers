"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, LinkButton } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { relativeDate } from "@/lib/format";
import { JOB_STATUS_LABELS, PRIORITY_LABELS, JOB_STATUS_FLOW } from "@/lib/masters";
import { JOB_STATUS_TONE, PRIORITY_TONE } from "@/lib/ui";

interface JobRow {
  id: string;
  jobNumber: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: string;
  plannedVisitDate: string | null;
  customer: { id: string; companyName: string };
  site: { id: string; name: string };
  serviceType: { id: string; name: string };
  engineer: { id: string; name: string } | null;
  technician: { id: string; name: string } | null;
}

interface CustomerOption {
  id: string;
  code: string;
  companyName: string;
}

interface StaffOption {
  id: string;
  name: string;
  isEngineer: boolean;
  isTechnician: boolean;
}

const OPEN_STATUSES = JOB_STATUS_FLOW.filter((s) => s !== "COMPLETED" && s !== "CLOSED").join(",");

type Quick = "" | "open" | "today" | "overdue" | "awaiting";

export default function JobsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quick, setQuick] = useState<Quick>("");
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [engineers, setEngineers] = useState<StaffOption[]>([]);

  useEffect(() => {
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
    api.get<StaffOption[]>("/api/staff/options").then(setEngineers).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const query: Record<string, string | number | undefined> = {
        q, priority, customerId, engineerId, page, pageSize: 25,
      };
      if (quick === "open") query.status = OPEN_STATUSES;
      else if (quick === "awaiting") query.status = "CONFIRMATION_PENDING";
      else if (status) query.status = status;

      if (quick === "overdue") query.overdue = 1;
      if (quick === "today") {
        query.from = today;
        query.to = today;
      } else {
        if (from) query.from = from;
        if (to) query.to = to;
      }

      const res = await api.list<JobRow>(`/api/jobs${qs(query)}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load service jobs", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, priority, engineerId, customerId, from, to, quick, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const toggleQuick = (v: Quick) => {
    setQuick((cur) => (cur === v ? "" : v));
    setStatus("");
    setPage(1);
  };

  const columns: Column<JobRow>[] = [
    {
      key: "jobNumber",
      header: "Job No.",
      cell: (r) => <span className="font-semibold">{r.jobNumber}</span>,
    },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <span>
          <span className="block font-medium text-slate-800">{r.customer.companyName}</span>
          <span className="block text-xs text-slate-500">{r.site.name}</span>
        </span>
      ),
    },
    { key: "serviceType", header: "Service type", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.serviceType.name}</span> },
    {
      key: "priority",
      header: "Priority",
      align: "center",
      cell: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABELS[r.priority]}</Badge>,
    },
    {
      key: "engineer",
      header: "Engineer",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{r.engineer?.name ?? r.technician?.name ?? "Unassigned"}</span>,
    },
    {
      key: "plannedVisitDate",
      header: "Planned visit",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{relativeDate(r.plannedVisitDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={JOB_STATUS_TONE[r.status]}>{JOB_STATUS_LABELS[r.status]}</Badge>,
    },
  ];

  const activeFilters = [status, priority, engineerId, customerId, from, to].filter(Boolean).length + (quick ? 1 : 0);

  const chip = (label: string, value: Quick) => (
    <button
      type="button"
      onClick={() => toggleQuick(value)}
      className={clsx(
        "te-focus inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        quick === value
          ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Service Jobs"
        description="Every visit, MOM and report is created against a service job."
        crumbs={[{ label: "Service Jobs" }]}
        actions={
          <LinkButton href="/jobs/new">
            <Plus className="h-4 w-4" /> New Job
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {chip("Open", "open")}
        {chip("Today's visits", "today")}
        {chip("Overdue", "overdue")}
        {chip("Awaiting confirmation", "awaiting")}
      </div>

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setStatus(""); setPriority(""); setEngineerId(""); setCustomerId("");
              setFrom(""); setTo(""); setQuick(""); setPage(1);
            }}
          >
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search job no., customer, site, engineer…" />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => { setStatus(v); setQuick(""); setPage(1); }}
              options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Priority"
              value={priority}
              onChange={(v) => { setPriority(v); setPage(1); }}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All priorities"
            />
            <FilterSelect
              label="Engineer"
              value={engineerId}
              onChange={(v) => { setEngineerId(v); setPage(1); }}
              options={engineers.map((e) => ({ value: e.id, label: e.name }))}
              allLabel="All engineers"
            />
            <FilterSelect
              label="Customer"
              value={customerId}
              onChange={(v) => { setCustomerId(v); setPage(1); }}
              options={customers.map((c) => ({ value: c.id, label: c.companyName }))}
              allLabel="All customers"
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
            rowHref={(r) => `/jobs/${r.id}`}
            emptyTitle={q || activeFilters ? "No service jobs match your filters" : "No service jobs yet"}
            emptyDescription={q || activeFilters ? "Try a different search term or clear the filters." : "Create your first service job to schedule a site visit."}
            emptyAction={!q && !activeFilters ? <LinkButton href="/jobs/new"><Plus className="h-4 w-4" /> New Job</LinkButton> : undefined}
          />
        </div>
      </Card>
    </>
  );
}
