"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, LinkButton, Input } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";

interface MomRow {
  id: string;
  momNumber: string;
  meetingDate: string;
  meetingTime: string | null;
  status: string;
  version: number;
  customer: { id: string; companyName: string };
  site: { id: string; name: string };
  job: { id: string; jobNumber: string };
  _count: { actionPoints: number; photos: number };
}

interface CustomerOption {
  id: string;
  companyName: string;
}

const CHIPS: { key: string; label: string }[] = [
  { key: "CONFIRMATION_PENDING", label: "Awaiting confirmation" },
  { key: "CLIENT_CONFIRMED", label: "Client confirmed" },
  { key: "DRAFT", label: "Draft" },
];

export default function MomListPage() {
  const toast = useToast();
  const [rows, setRows] = useState<MomRow[]>([]);
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
      const res = await api.list<MomRow>(`/api/mom${qs({ q, status, customerId, from, to, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load MOMs", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, customerId, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<MomRow>[] = [
    {
      key: "momNumber",
      header: "MOM No.",
      cell: (r) => (
        <span>
          <span className="block font-semibold">{r.momNumber}</span>
          <span className="block text-xs font-normal text-slate-500">v{r.version}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block font-medium text-slate-800">{r.customer.companyName}</span>
          <span className="block text-xs text-slate-500">{r.site.name}</span>
        </span>
      ),
    },
    {
      key: "job",
      header: "Job No.",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{r.job.jobNumber}</span>,
    },
    {
      key: "meetingDate",
      header: "Meeting date",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          {formatDate(r.meetingDate)}
          {r.meetingTime && <span className="block text-xs text-slate-400">{r.meetingTime}</span>}
        </span>
      ),
    },
    {
      key: "actionPoints",
      header: "Action points",
      align: "center",
      cell: (r) => <span className="text-xs font-medium text-slate-600">{r._count.actionPoints}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={DOC_STATUS_TONE[r.status]}>{DOC_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  const activeFilters = [status, customerId, from, to].filter(Boolean).length;
  const toggleChip = (key: string) => { setStatus((s) => (s === key ? "" : key)); setPage(1); };

  return (
    <>
      <PageHeader
        title="Minutes of Meeting"
        description="Record site meetings and track the action points that come out of them."
        crumbs={[{ label: "MOM" }]}
        actions={
          <LinkButton href="/mom/new">
            <Plus className="h-4 w-4" /> New MOM
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggleChip(c.key)}
            className={clsx(
              "te-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              status === c.key
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
            onReset={() => { setStatus(""); setCustomerId(""); setFrom(""); setTo(""); setPage(1); }}
          >
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search MOM no., customer, site…" />
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
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              aria-label="From date"
              className="h-9 w-auto"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              aria-label="To date"
              className="h-9 w-auto"
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
            rowHref={(r) => `/mom/${r.id}`}
            emptyTitle={q || activeFilters ? "No MOMs match your filters" : "No MOMs yet"}
            emptyDescription={q || activeFilters ? "Try a different search term or clear the filters." : "Create a MOM from a service job to record the meeting and its action points."}
            emptyAction={!q && !activeFilters ? <LinkButton href="/mom/new"><Plus className="h-4 w-4" /> New MOM</LinkButton> : undefined}
          />
        </div>
      </Card>
    </>
  );
}
