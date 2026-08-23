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
import { DOC_STATUS_LABELS } from "@/lib/masters";
import { DOC_STATUS_TONE } from "@/lib/ui";

interface VisitRow {
  id: string;
  visitNumber: string;
  visitDate: string;
  status: string;
  job: { id: string; jobNumber: string } | null;
  customer: { id: string; companyName: string } | null;
  site: { id: string; name: string } | null;
  engineer: { id: string; name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

export default function VisitsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get<StaffOption[]>("/api/staff/options")
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<VisitRow>(`/api/visits${qs({ q, status, engineerId, from, to, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load site visits", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, engineerId, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<VisitRow>[] = [
    {
      key: "visitNumber",
      header: "Visit No.",
      cell: (r) => <span className="font-semibold">{r.visitNumber}</span>,
    },
    {
      key: "job",
      header: "Job No.",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{r.job?.jobNumber ?? "—"}</span>,
    },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <span>
          <span className="block truncate text-slate-700">{r.customer?.companyName ?? "—"}</span>
          <span className="block truncate text-xs text-slate-400">{r.site?.name ?? "—"}</span>
        </span>
      ),
    },
    { key: "date", header: "Visit date", cell: (r) => <span className="text-slate-600">{formatDate(r.visitDate)}</span> },
    {
      key: "engineer",
      header: "Engineer",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{r.engineer?.name ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={DOC_STATUS_TONE[r.status] ?? "neutral"}>{DOC_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  const activeFilters = [status, engineerId, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Site Visits"
        description="Every visit is linked to a service job and can become a MOM."
        crumbs={[{ label: "Site Visits" }]}
        actions={
          <LinkButton href="/visits/new">
            <Plus className="h-4 w-4" /> New Site Visit
          </LinkButton>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setStatus("");
              setEngineerId("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Search visit number, job number, customer or site…"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={Object.entries(DOC_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Engineer"
              value={engineerId}
              onChange={(v) => {
                setEngineerId(v);
                setPage(1);
              }}
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              allLabel="All engineers"
            />
            <input
              type="date"
              aria-label="Visits from"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
            />
            <input
              type="date"
              aria-label="Visits to"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
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
            rowHref={(r) => `/visits/${r.id}`}
            emptyTitle={activeFilters || q ? "No site visits match your filters" : "No site visits recorded yet"}
            emptyDescription={
              activeFilters || q
                ? "Try a different search term or clear the filters."
                : "Create a site visit from a service job to record observations and photographs."
            }
            emptyAction={
              !activeFilters && !q ? (
                <LinkButton href="/visits/new">
                  <Plus className="h-4 w-4" /> New Site Visit
                </LinkButton>
              ) : undefined
            }
          />
        </div>
      </Card>
    </>
  );
}
