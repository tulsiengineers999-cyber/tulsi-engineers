"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, RotateCcw } from "lucide-react";
import { Button, Card, Field, Input, Textarea, Alert, LoadingBlock, Badge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface PermissionCatalogue {
  modules: {
    key: string;
    label: string;
    permissions: { id: string | null; code: string; action: string; label: string }[];
  }[];
  actions: { key: string; label: string }[];
}

interface RoleDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rank: number;
  userCount: number;
  permissions: string[];
}

export function PermissionMatrix({ roleId, canManage }: { roleId: string; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [catalogue, setCatalogue] = useState<PermissionCatalogue | null>(null);
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState({ name: "", description: "", rank: "100" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<PermissionCatalogue>("/api/permissions"), api.get<RoleDetail>(`/api/roles/${roleId}`)])
      .then(([cat, r]) => {
        setCatalogue(cat);
        setRole(r);
        setGranted(new Set(r.permissions));
        setMeta({ name: r.name, description: r.description ?? "", rank: String(r.rank) });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this role."))
      .finally(() => setLoading(false));
  }, [roleId]);

  /** Only actions that at least one module uses become columns. */
  const columns = useMemo(() => {
    if (!catalogue) return [];
    const used = new Set(catalogue.modules.flatMap((m) => m.permissions.map((p) => p.action)));
    return catalogue.actions.filter((a) => used.has(a.key));
  }, [catalogue]);

  const readOnly = !canManage || Boolean(role?.isSystem);
  const isSuperAdmin = role?.code === "SUPER_ADMIN";

  const dirty = useMemo(() => {
    if (!role) return false;
    if (meta.name !== role.name) return true;
    if (meta.description !== (role.description ?? "")) return true;
    if (Number(meta.rank) !== role.rank) return true;
    if (granted.size !== role.permissions.length) return true;
    return role.permissions.some((c) => !granted.has(c));
  }, [role, meta, granted]);

  const toggle = (code: string) => {
    if (readOnly) return;
    setGranted((g) => {
      const next = new Set(g);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleRow = (moduleKey: string) => {
    if (readOnly || !catalogue) return;
    const mod = catalogue.modules.find((m) => m.key === moduleKey);
    if (!mod) return;
    const codes = mod.permissions.map((p) => p.code);
    const allOn = codes.every((c) => granted.has(c));
    setGranted((g) => {
      const next = new Set(g);
      codes.forEach((c) => (allOn ? next.delete(c) : next.add(c)));
      return next;
    });
  };

  const toggleAll = () => {
    if (readOnly || !catalogue) return;
    const all = catalogue.modules.flatMap((m) => m.permissions.map((p) => p.code));
    setGranted((g) => (g.size === all.length ? new Set() : new Set(all)));
  };

  const reset = () => {
    if (!role) return;
    setGranted(new Set(role.permissions));
    setMeta({ name: role.name, description: role.description ?? "", rank: String(role.rank) });
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await api.put(`/api/roles/${role.id}`, {
        code: role.code,
        name: meta.name,
        description: meta.description,
        rank: Number(meta.rank),
        permissions: [...granted],
      });
      toast.success("Role updated", `${granted.size} permission(s) granted.`);
      const fresh = await api.get<RoleDetail>(`/api/roles/${roleId}`);
      setRole(fresh);
      router.refresh();
    } catch (err) {
      toast.error("Could not save this role", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.del(`/api/roles/${roleId}`);
      toast.success("Role deleted");
      router.push("/roles");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete this role", err instanceof ApiError ? err.message : undefined);
      setSaving(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading permissions…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!catalogue || !role) return null;

  const totalAvailable = catalogue.modules.reduce((n, m) => n + m.permissions.length, 0);

  return (
    <div className="space-y-5">
      {isSuperAdmin && (
        <Alert tone="info" title="Super Admin always has every permission">
          This role is granted every permission automatically, including any added in future updates. It cannot be
          restricted.
        </Alert>
      )}
      {role.isSystem && !isSuperAdmin && (
        <Alert tone="info" title="This is a system role">
          The eight roles shipped with TULSI ENGINEERS are read-only so a working configuration always exists. To use a
          different mix of permissions, create a new role and assign users to it.
        </Alert>
      )}

      <Card title="Role details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Role name" required>
            <Input value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} readOnly={readOnly} />
          </Field>
          <Field label="Role code">
            <Input value={role.code} readOnly className="font-mono" />
          </Field>
          <Field label="Rank" hint="lower is more senior">
            <Input
              type="number"
              min={1}
              max={999}
              value={meta.rank}
              onChange={(e) => setMeta((m) => ({ ...m, rank: e.target.value }))}
              readOnly={readOnly}
            />
          </Field>
          <Field label="Description" className="sm:col-span-3">
            <Textarea
              rows={2}
              value={meta.description}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              readOnly={readOnly}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Permissions"
        description={`${isSuperAdmin ? totalAvailable : granted.size} of ${totalAvailable} granted · ${role.userCount} user(s) hold this role`}
        actions={
          !readOnly ? (
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {granted.size === totalAvailable ? "Clear all" : "Select all"}
            </Button>
          ) : undefined
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Module
                </th>
                {columns.map((a) => (
                  <th
                    key={a.key}
                    className="px-2 py-2.5 text-center text-[10px] font-semibold tracking-wide text-slate-500 uppercase"
                  >
                    {a.label.replace(/ .*/, "")}
                  </th>
                ))}
                {!readOnly && <th className="px-3 py-2.5 text-right text-[10px] text-slate-400">All</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalogue.modules.map((m) => {
                const codes = m.permissions.map((p) => p.code);
                const rowOn = codes.every((c) => granted.has(c));
                return (
                  <tr key={m.key} className="hover:bg-slate-50/70">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-[13px] font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50/70"
                    >
                      {m.label}
                    </th>
                    {columns.map((a) => {
                      const perm = m.permissions.find((p) => p.action === a.key);
                      if (!perm) return <td key={a.key} className="px-2 py-2 text-center text-slate-200">–</td>;
                      const on = isSuperAdmin || granted.has(perm.code);
                      return (
                        <td key={a.key} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={readOnly}
                            onChange={() => toggle(perm.code)}
                            aria-label={perm.label}
                            title={perm.code}
                            className="te-focus h-4 w-4 rounded border-slate-300 accent-[var(--te-primary)] disabled:opacity-60"
                          />
                        </td>
                      );
                    })}
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleRow(m.key)}
                          className="te-focus text-[11px] font-medium text-slate-400 hover:text-[var(--te-primary)]"
                        >
                          {rowOn ? "none" : "all"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {!readOnly && (
        <>
          {dirty && (
            <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)] sm:mx-0 sm:rounded-xl sm:border">
              <p className="text-sm text-slate-600">
                <Badge tone="warning">Unsaved changes</Badge>{" "}
                <span className="ml-1">{granted.size} permission(s) selected</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} disabled={saving}>
                  <RotateCcw className="h-4 w-4" /> Discard
                </Button>
                <Button onClick={save} loading={saving}>
                  <Save className="h-4 w-4" /> Save role
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete role
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        loading={saving}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this role?"
        confirmLabel="Delete role"
        message={
          <>
            <b>{role.name}</b> will be removed permanently. Roles that still have users assigned cannot be deleted —
            move those users to another role first.
          </>
        }
      />
    </div>
  );
}
