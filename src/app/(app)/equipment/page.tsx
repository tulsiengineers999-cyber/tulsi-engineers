"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { EquipmentFormModal } from "./EquipmentFormModal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { AMC_TONE } from "@/lib/ui";
import { AMC_STATUS_LABELS, EQUIPMENT_TYPE_LABELS } from "@/lib/masters";

interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  type: string;
  serialNumber: string | null;
  capacity: string | null;
  amcStatus: string;
  status: "ACTIVE" | "INACTIVE";
  customer: { id: string; code: string; companyName: string };
  site: { id: string; code: string; name: string };
}

interface CustomerOption {
  id: string;
  code: string;
  companyName: string;
}

interface SiteOption {
  id: string;
  name: string;
  customerId: string;
}

export default function EquipmentPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? "";
  const initialSiteId = searchParams.get("siteId") ?? "";

  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [siteId, setSiteId] = useState(initialSiteId);
  const [type, setType] = useState("");
  const [amcStatus, setAmcStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);

  useEffect(() => {
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .get<SiteOption[]>(`/api/sites/options${qs({ customerId })}`)
      .then(setSites)
      .catch(() => undefined);
  }, [customerId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<EquipmentRow>(
        `/api/equipment${qs({ q, customerId, siteId, type, amcStatus, page, pageSize: 25 })}`,
      );
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load equipment", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, customerId, siteId, type, amcStatus, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<EquipmentRow>[] = [
    {
      key: "equipment",
      header: "Equipment",
      cell: (r) => (
        <span>
          <span className="block font-semibold">{r.name}</span>
          <span className="block text-xs font-normal text-slate-500">{r.code}</span>
        </span>
      ),
    },
    { key: "type", header: "Type", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{EQUIPMENT_TYPE_LABELS[r.type] ?? r.type}</span> },
    {
      key: "location",
      header: "Customer / Site",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block">{r.customer.companyName}</span>
          <span className="block text-xs text-slate-400">{r.site.name}</span>
        </span>
      ),
    },
    { key: "serial", header: "Serial No.", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.serialNumber ?? "—"}</span> },
    { key: "capacity", header: "Capacity", hideOnMobile: true, cell: (r) => <span className="text-slate-600">{r.capacity ?? "—"}</span> },
    {
      key: "amc",
      header: "AMC status",
      align: "center",
      cell: (r) => <Badge tone={AMC_TONE[r.amcStatus]}>{AMC_STATUS_LABELS[r.amcStatus] ?? r.amcStatus}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"} dot>{r.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>,
    },
  ];

  const activeFilters = [customerId, siteId, type, amcStatus].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Equipment"
        description="Boilers, heaters, chimneys and other assets installed at customer sites."
        crumbs={[{ label: "Equipment" }]}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Equipment
          </Button>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar activeCount={activeFilters} onReset={() => { setCustomerId(""); setSiteId(""); setType(""); setAmcStatus(""); setPage(1); }}>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search equipment, code, serial number…" />
            <FilterSelect
              label="Customer"
              value={customerId}
              onChange={(v) => { setCustomerId(v); setSiteId(""); setPage(1); }}
              options={customers.map((c) => ({ value: c.id, label: c.companyName }))}
              allLabel="All customers"
            />
            <FilterSelect
              label="Site"
              value={siteId}
              onChange={(v) => { setSiteId(v); setPage(1); }}
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
              allLabel="All sites"
            />
            <FilterSelect
              label="Type"
              value={type}
              onChange={(v) => { setType(v); setPage(1); }}
              options={Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All types"
            />
            <FilterSelect
              label="AMC status"
              value={amcStatus}
              onChange={(v) => { setAmcStatus(v); setPage(1); }}
              options={Object.entries(AMC_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All AMC statuses"
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
            rowHref={(r) => `/equipment/${r.id}`}
            emptyTitle={activeFilters || q ? "No equipment matches your filters" : "No equipment yet"}
            emptyDescription={activeFilters || q ? "Try a different search term or clear the filters." : "Add equipment installed at a customer site."}
            emptyAction={!activeFilters && !q ? <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New Equipment</Button> : undefined}
          />
        </div>
      </Card>

      <EquipmentFormModal
        open={formOpen}
        initial={initialCustomerId || initialSiteId ? { customerId: initialCustomerId, siteId: initialSiteId } : undefined}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </>
  );
}
