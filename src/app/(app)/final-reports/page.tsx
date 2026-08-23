"use client";

import { useCallback, useEffect, useState } from "react";
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

interface CustomerOption {
  id: string;
  companyName: string;
}

interface FinalReportRow {
  id: string;
  reportNumber: string;
  completionDate: string | null;
  status: string;
  job: { id: string; jobNumber: string };
  customer: { id: string; companyName: string };
  site: { id: string; name: string };
}

export default function FinalReportsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<FinalReportRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<FinalReportRow>(`/api/final-reports${qs({ q, status, customerId, from, to, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load final service reports", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, customerId, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<FinalReportRow>[] = [
    { key: "report", header: "Report No.", cell: (r) => <span className="font-semibold">{r.reportNumber}</span> },
    { key: "job", header: "Job No.", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.job.jobNumber}</span> },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <span>
          <span className="block">{r.customer.companyName}</span>
          <span className="block text-xs text-slate-500">{r.site.name}</span>
        </span>
      ),
    },
    { key: "completion", header: "Completion date", cell: (r) => <span className="text-slate-600">{formatDate(r.completionDate)}</span> },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={DOC_STATUS_TONE[r.status]}>{DOC_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  const activeFilters = [status, customerId, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Final Service Reports"
        description="The complete, signed-off record of a service job — issued to the customer."
        crumbs={[{ label: "Final Service Reports" }]}
        actions={
          <LinkButton href="/final-reports/new">
            <Plus className="h-4 w-4" /> New Final Report
          </LinkButton>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => { setStatus(""); setCustomerId(""); setFrom(""); setTo(""); setPage(1); }}
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
              label="Customer"
              value={customerId}
              onChange={(v) => { setCustomerId(v); setPage(1); }}
              options={customers.map((c) => ({ value: c.id, label: c.companyName }))}
              allLabel="All customers"
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
            rowHref={(r) => `/final-reports/${r.id}`}
            emptyTitle={q || activeFilters ? "No reports match your filters" : "No final service reports yet"}
            emptyDescription={q || activeFilters ? "Try a different search term or clear the filters." : "Generate a final service report once the job's daily work is complete."}
            emptyAction={!q && !activeFilters ? <LinkButton href="/final-reports/new"><Plus className="h-4 w-4" /> New Final Report</LinkButton> : undefined}
          />
        </div>
      </Card>
    </>
  );
}
