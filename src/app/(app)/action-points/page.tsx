"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Select, Input } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { relativeDate } from "@/lib/format";
import { ACTION_POINT_STATUS_LABELS, PRIORITY_LABELS, RESPONSIBLE_PARTY_LABELS } from "@/lib/masters";
import { PRIORITY_TONE } from "@/lib/ui";
import Link from "next/link";

interface ActionPointRow {
  id: string;
  actionPoint: string;
  responsiblePerson: string | null;
  responsibleParty: string;
  responsibleCompany: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  mom: { id: string; momNumber: string; customer: { id: string; companyName: string }; site: { id: string; name: string } };
  generatedJob: { id: string; jobNumber: string } | null;
}

export default function ActionPointsTrackerPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ActionPointRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [responsibleParty, setResponsibleParty] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<ActionPointRow>(
        `/api/action-points${qs({ q, status, responsibleParty, overdue: overdue ? "1" : undefined, dueFrom, dueTo, page, pageSize: 25 })}`,
      );
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load action points", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, responsibleParty, overdue, dueFrom, dueTo, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const updateStatus = async (id: string, next: string) => {
    const previous = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: next } : x)));
    try {
      await api.patch(`/api/action-points/${id}`, { status: next });
      toast.success("Status updated");
    } catch (err) {
      setRows(previous);
      toast.error("Could not update status", err instanceof ApiError ? err.message : undefined);
    }
  };

  const isOverdue = (r: ActionPointRow) => Boolean(r.dueDate) && new Date(r.dueDate!) < new Date() && !["COMPLETED", "CANCELLED"].includes(r.status);

  const columns: Column<ActionPointRow>[] = [
    {
      key: "actionPoint",
      header: "Action point",
      cell: (r) => (
        <span>
          <span className="block max-w-sm truncate font-medium text-slate-800">{r.actionPoint}</span>
          {r.generatedJob && (
            <Link href={`/jobs/${r.generatedJob.id}`} className="text-xs text-[var(--te-primary)] hover:underline">
              → Job {r.generatedJob.jobNumber}
            </Link>
          )}
        </span>
      ),
    },
    {
      key: "mom",
      header: "MOM No.",
      hideOnMobile: true,
      cell: (r) => (
        <Link href={`/mom/${r.mom.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
          {r.mom.momNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block">{r.mom.customer.companyName}</span>
          <span className="block text-xs text-slate-400">{r.mom.site.name}</span>
        </span>
      ),
    },
    {
      key: "responsible",
      header: "Responsible",
      cell: (r) => (
        <span className="text-slate-600">
          {r.responsiblePerson || RESPONSIBLE_PARTY_LABELS[r.responsibleParty] || r.responsibleParty}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due date",
      cell: (r) => <span className={isOverdue(r) ? "font-medium text-red-600" : "text-slate-600"}>{relativeDate(r.dueDate)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      align: "center",
      hideOnMobile: true,
      cell: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABELS[r.priority] ?? r.priority}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="h-8 w-36 py-1 text-xs">
          {Object.entries(ACTION_POINT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      ),
    },
  ];

  const activeFilters = [status, responsibleParty, dueFrom, dueTo].filter(Boolean).length + (overdue ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Action Points"
        description="Every action point raised across all Minutes of Meeting, in one place."
        crumbs={[{ label: "Action Points" }]}
      />

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        <button
          type="button"
          onClick={() => { setOverdue((v) => !v); setPage(1); }}
          className={clsx(
            "te-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            overdue ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          Overdue
        </button>
      </div>

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => { setStatus(""); setResponsibleParty(""); setOverdue(false); setDueFrom(""); setDueTo(""); setPage(1); }}
          >
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search action point, MOM no., customer…" />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={Object.entries(ACTION_POINT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Responsible party"
              value={responsibleParty}
              onChange={(v) => { setResponsibleParty(v); setPage(1); }}
              options={Object.entries(RESPONSIBLE_PARTY_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All parties"
            />
            <Input type="date" value={dueFrom} onChange={(e) => { setDueFrom(e.target.value); setPage(1); }} aria-label="Due from" className="h-9 w-auto" />
            <Input type="date" value={dueTo} onChange={(e) => { setDueTo(e.target.value); setPage(1); }} aria-label="Due to" className="h-9 w-auto" />
          </FilterBar>
        </div>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            meta={meta}
            onPageChange={setPage}
            emptyTitle={q || activeFilters ? "No action points match your filters" : "No action points yet"}
            emptyDescription="Action points are added while creating or editing a MOM."
          />
        </div>
      </Card>
    </>
  );
}
