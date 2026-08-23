"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Power, Trash2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, Field, Input, Select, Alert, LoadingBlock, EmptyState } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface ServiceTypeRow {
  id: string;
  name: string;
  category: string | null;
  isSystem: boolean;
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE";
  _count?: { jobs: number };
}

const EMPTY = { id: "", name: "", category: "", sortOrder: "100", status: "ACTIVE" as "ACTIVE" | "INACTIVE" };

export default function ServiceMasterPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ServiceTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceTypeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<ServiceTypeRow>(`/api/service-types${qs({ q, pageSize: 200 })}`);
      setRows(res.items);
    } catch (err) {
      toast.error("Could not load service types", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const grouped = useMemo(() => {
    const visible = rows.filter((r) => showInactive || r.status === "ACTIVE");
    const map = new Map<string, ServiceTypeRow[]>();
    for (const r of visible) {
      const key = r.category ?? "Uncategorised";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, showInactive]);

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort() as string[],
    [rows],
  );

  const openNew = () => {
    setValues(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (r: ServiceTypeRow) => {
    setValues({
      id: r.id,
      name: r.name,
      category: r.category ?? "",
      sortOrder: String(r.sortOrder),
      status: r.status,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const payload = {
      name: values.name,
      category: values.category,
      sortOrder: Number(values.sortOrder),
      status: values.status,
    };
    try {
      if (values.id) await api.put(`/api/service-types/${values.id}`, payload);
      else await api.post("/api/service-types", payload);
      toast.success(values.id ? "Service type updated" : "Service type added");
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (r: ServiceTypeRow) => {
    try {
      await api.put(`/api/service-types/${r.id}`, {
        name: r.name,
        category: r.category ?? "",
        sortOrder: r.sortOrder,
        status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast.success(r.status === "ACTIVE" ? "Service type deactivated" : "Service type activated");
      load();
    } catch (err) {
      toast.error("Could not change the status", err instanceof ApiError ? err.message : undefined);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/service-types/${deleteTarget.id}`);
      toast.success("Service type deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error("Could not delete this service type", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Service Master"
        description="These values populate the Service Type dropdown on every job, MOM and report."
        crumbs={[{ label: "Service Master" }]}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New Service Type
          </Button>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search service types…" className="max-w-sm flex-1" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="te-focus h-4 w-4 rounded border-slate-300 accent-[var(--te-primary)]"
            />
            Show inactive
          </label>
          <span className="ml-auto text-xs text-slate-500">
            {rows.filter((r) => r.status === "ACTIVE").length} active of {rows.length}
          </span>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {loading ? (
            <LoadingBlock label="Loading service types…" />
          ) : grouped.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No service types found"
              description="Add the services TULSI ENGINEERS offers so they appear in every job dropdown."
              action={
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" /> New Service Type
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map(([category, list]) => (
                <div key={category}>
                  <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    {category} ({list.length})
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {list.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <span className="w-10 shrink-0 text-center text-xs text-slate-400">{r.sortOrder}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{r.name}</span>
                          {r._count?.jobs ? (
                            <span className="text-[11px] text-slate-400">used by {r._count.jobs} job(s)</span>
                          ) : null}
                        </span>
                        <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"} dot>
                          {r.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Badge>
                        <span className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleStatus(r)}
                            aria-label={r.status === "ACTIVE" ? `Deactivate ${r.name}` : `Activate ${r.name}`}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          {!r.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(r)}
                              aria-label={`Delete ${r.name}`}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={values.id ? "Edit service type" : "New service type"}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button form="service-type-form" type="submit" loading={busy}>
              {values.id ? "Save changes" : "Add service type"}
            </Button>
          </>
        }
      >
        <form id="service-type-form" onSubmit={save} className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Service name" required>
            <Input
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Boiler Refractory Work"
              required
              autoFocus
            />
          </Field>
          <Field label="Category" hint="groups the dropdown">
            <Input
              list="service-categories"
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              placeholder="Boiler"
            />
            <datalist id="service-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sort order" hint="lower shows first">
              <Input
                type="number"
                min={0}
                max={9999}
                value={values.sortOrder}
                onChange={(e) => setValues((v) => ({ ...v, sortOrder: e.target.value }))}
              />
            </Field>
            <Field label="Status">
              <Select
                value={values.status}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        loading={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete this service type?"
        confirmLabel="Delete"
        message={
          <>
            <b>{deleteTarget?.name}</b> will be removed from the dropdown. Service types already used by a job cannot be
            deleted — set them to Inactive instead so historical records stay intact.
          </>
        }
      />
    </>
  );
}
