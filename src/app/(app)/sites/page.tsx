"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { SiteFormModal } from "./SiteFormModal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface SiteRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  contactPerson: string | null;
  mobile: string | null;
  status: "ACTIVE" | "INACTIVE";
  customer: { id: string; code: string; companyName: string };
  _count: { equipment: number; jobs: number };
}

interface CustomerOption {
  id: string;
  code: string;
  companyName: string;
}

export default function SitesPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? "";

  const [rows, setRows] = useState<SiteRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    api
      .get<CustomerOption[]>("/api/customers/options")
      .then(setCustomers)
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<SiteRow>(`/api/sites${qs({ q, customerId, status, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load sites", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, customerId, status, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<SiteRow>[] = [
    {
      key: "site",
      header: "Site",
      cell: (r) => (
        <span>
          <span className="block font-semibold">{r.name}</span>
          <span className="block text-xs font-normal text-slate-500">{r.code}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{r.customer.companyName}</span>,
    },
    {
      key: "location",
      header: "Location",
      hideOnMobile: true,
      cell: (r) => <span className="text-slate-600">{[r.address, r.city, r.state].filter(Boolean).join(", ") || "—"}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block">{r.contactPerson ?? "—"}</span>
          <span className="block text-xs text-slate-400">{r.mobile ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "counts",
      header: "Equipment / Jobs",
      align: "center",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-xs font-medium text-slate-600">
          {r._count.equipment} / {r._count.jobs}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"} dot>{r.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>,
    },
  ];

  const activeFilters = [customerId, status].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Sites"
        description="Every site belongs to a customer and can hold equipment and service jobs."
        crumbs={[{ label: "Sites" }]}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Site
          </Button>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar activeCount={activeFilters} onReset={() => { setCustomerId(""); setStatus(""); setPage(1); }}>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search site, code, address, contact…" />
            <FilterSelect
              label="Customer"
              value={customerId}
              onChange={(v) => { setCustomerId(v); setPage(1); }}
              options={customers.map((c) => ({ value: c.id, label: c.companyName }))}
              allLabel="All customers"
            />
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
            rowHref={(r) => `/sites/${r.id}`}
            emptyTitle={q || customerId || status ? "No sites match your filters" : "No sites yet"}
            emptyDescription={q || customerId || status ? "Try a different search term or clear the filters." : "Add a site to record equipment and raise service jobs."}
            emptyAction={!q && !customerId && !status ? <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New Site</Button> : undefined}
          />
        </div>
      </Card>

      <SiteFormModal
        open={formOpen}
        initial={initialCustomerId ? { customerId: initialCustomerId } : undefined}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </>
  );
}
