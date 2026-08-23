"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, LinkButton, EmptyState, Spinner } from "@/components/ui/primitives";
import { Pagination, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { Modal } from "@/components/ui/Modal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, titleCase } from "@/lib/format";
import { MODULES } from "@/lib/rbac";
import type { BadgeTone } from "@/components/ui/primitives";

interface AuditLogRow {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  module: string;
  recordId: string | null;
  recordLabel: string | null;
  description: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/** Fixed system enum — display formatting only, not business data. */
const AUDIT_ACTIONS = [
  "LOGIN", "LOGIN_FAILED", "LOGOUT", "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE",
  "PDF_GENERATED", "EMAIL_SENT", "WHATSAPP_SENT", "CLIENT_CONFIRMED", "CORRECTION_REQUESTED",
  "USER_CHANGED", "SETTINGS_CHANGED", "OTP_SENT", "OTP_VERIFIED", "OTP_FAILED", "EXPORT",
];

const ACTION_TONE: Record<string, BadgeTone> = {
  LOGIN: "info", LOGOUT: "neutral", LOGIN_FAILED: "danger",
  CREATE: "success", UPDATE: "primary", DELETE: "danger", STATUS_CHANGE: "accent",
  PDF_GENERATED: "info", EMAIL_SENT: "info", WHATSAPP_SENT: "info",
  CLIENT_CONFIRMED: "success", CORRECTION_REQUESTED: "warning",
  USER_CHANGED: "warning", SETTINGS_CHANGED: "warning",
  OTP_SENT: "neutral", OTP_VERIFIED: "success", OTP_FAILED: "danger", EXPORT: "neutral",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function DiffTable({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const oldObj = isPlainObject(oldValue) ? oldValue : null;
  const newObj = isPlainObject(newValue) ? newValue : null;

  if (!oldObj && !newObj) {
    return <p className="py-6 text-center text-sm text-slate-500">No field-level details were recorded for this entry.</p>;
  }

  const keys = [...new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})])];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Field</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Before</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {keys.map((key) => {
            const before = oldObj ? oldObj[key] : undefined;
            const after = newObj ? newObj[key] : undefined;
            const changed = JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
            return (
              <tr key={key} className={changed ? "bg-amber-50/40" : undefined}>
                <td className="px-3 py-2 align-top font-medium whitespace-nowrap text-slate-700">{titleCase(key)}</td>
                <td className="px-3 py-2 align-top whitespace-pre-wrap text-slate-500">
                  {oldObj ? <span className={changed ? "line-through decoration-red-300" : ""}>{displayValue(before)}</span> : "—"}
                </td>
                <td className="px-3 py-2 align-top whitespace-pre-wrap text-slate-800">
                  {newObj ? <span className={changed ? "font-medium text-green-700" : ""}>{displayValue(after)}</span> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<AuditLogRow>(`/api/audit-logs${qs({ q, module, action, from, to, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load the audit log", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, module, action, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const activeFilters = [module, action, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Every create, edit, delete and status change made in the system."
        crumbs={[{ label: "Audit Logs" }]}
        actions={
          <LinkButton href={`/api/audit-logs/export${qs({ q, module, action, from, to })}`} variant="outline" prefetch={false}>
            <Download className="h-4 w-4" /> Export CSV
          </LinkButton>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => { setModule(""); setAction(""); setFrom(""); setTo(""); setPage(1); }}
          >
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search user, record, description…" />
            <FilterSelect label="Module" value={module} onChange={(v) => { setModule(v); setPage(1); }} allLabel="All modules"
              options={MODULES.map((m) => ({ value: m.key, label: m.label }))} />
            <FilterSelect label="Action" value={action} onChange={(v) => { setAction(v); setPage(1); }} allLabel="All actions"
              options={AUDIT_ACTIONS.map((a) => ({ value: a, label: titleCase(a) }))} />
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date"
                className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date"
                className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600" />
            </div>
          </FilterBar>
        </div>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Spinner /> Loading audit entries…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Download}
              title={q || activeFilters ? "No audit entries match your filters" : "No audit entries yet"}
              description={q || activeFilters ? "Try a different search term or clear the filters." : "Every create, edit, delete and status change will be logged here."}
            />
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap">When</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap">User</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap">Action</th>
                      <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap sm:table-cell">Module</th>
                      <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap sm:table-cell">Record</th>
                      <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="cursor-pointer transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600">{formatDateTime(r.createdAt)}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{r.userName ?? "System"}</td>
                        <td className="px-3 py-3 text-center">
                          <Badge tone={ACTION_TONE[r.action] ?? "neutral"}>{titleCase(r.action)}</Badge>
                        </td>
                        <td className="hidden px-3 py-3 text-slate-600 sm:table-cell">{titleCase(r.module)}</td>
                        <td className="hidden px-3 py-3 text-slate-600 sm:table-cell">{r.recordLabel ?? "—"}</td>
                        <td className="hidden px-3 py-3 text-slate-500 sm:table-cell">{r.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-400">Click a row to see the full before / after detail.</p>
            </>
          )}
          {!loading && meta && meta.pageCount > 1 && (
            <Pagination meta={meta} onPageChange={setPage} />
          )}
        </div>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${titleCase(selected.action)} · ${selected.module ? titleCase(selected.module) : ""}` : "Audit entry"}
        description={selected ? `${selected.userName ?? "System"} · ${formatDateTime(selected.createdAt)}${selected.recordLabel ? ` · ${selected.recordLabel}` : ""}` : undefined}
        size="lg"
      >
        {selected && (
          <div className="space-y-3">
            {selected.description && <p className="text-sm text-slate-600">{selected.description}</p>}
            <DiffTable oldValue={selected.oldValue} newValue={selected.newValue} />
            {selected.ipAddress && <p className="text-xs text-slate-400">IP address: {selected.ipAddress}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
