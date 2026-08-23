"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, LinkButton } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { CustomerFormModal } from "./CustomerFormModal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";

interface CustomerRow {
  id: string;
  code: string;
  companyName: string;
  contactPerson: string | null;
  mobile: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  industry: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  _count: { sites: number; equipment: number; jobs: number };
}

export default function CustomersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<CustomerRow>(`/api/customers${qs({ q, status, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load customers", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "company",
      header: "Customer",
      cell: (r) => (
        <span>
          <span className="block font-semibold">{r.companyName}</span>
          <span className="block text-xs font-normal text-slate-500">{r.code}</span>
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block">{r.contactPerson ?? "—"}</span>
          <span className="block text-xs text-slate-400">{r.mobile ?? r.email ?? "—"}</span>
        </span>
      ),
    },
    { key: "city", header: "Location", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</span> },
    { key: "industry", header: "Industry", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.industry ?? "—"}</span> },
    {
      key: "counts",
      header: "Sites / Equipment / Jobs",
      align: "center",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-xs font-medium text-slate-600">
          {r._count.sites} / {r._count.equipment} / {r._count.jobs}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"} dot>{r.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>,
    },
    { key: "created", header: "Added", align: "right", hideOnMobile: true, cell: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span> },
  ];

  const activeFilters = [status].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Every site, equipment record, job and report is linked to a customer."
        crumbs={[{ label: "Customers" }]}
        actions={
          <>
            <LinkButton href="/api/customers/export" variant="outline" size="md" prefetch={false}>
              <Download className="h-4 w-4" /> Export
            </LinkButton>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New Customer
            </Button>
          </>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar activeCount={activeFilters} onReset={() => { setStatus(""); setPage(1); }}>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search company, code, contact, mobile, GST…" />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
              allLabel="All statuses"
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
            rowHref={(r) => `/customers/${r.id}`}
            emptyTitle={q || status ? "No customers match your filters" : "No customers yet"}
            emptyDescription={q || status ? "Try a different search term or clear the filters." : "Add your first customer to start creating sites, equipment and service jobs."}
            emptyAction={!q && !status ? <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New Customer</Button> : undefined}
          />
        </div>
      </Card>

      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </>
  );
}
