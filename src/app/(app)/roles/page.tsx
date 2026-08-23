"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShieldCheck, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, Field, Input, Textarea, Alert, LoadingBlock } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rank: number;
  userCount?: number;
  permissionCount?: number;
  _count?: { users: number; rolePermissions: number };
}

export default function RolesPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [values, setValues] = useState({ code: "", name: "", description: "", rank: "100" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<RoleRow>("/api/roles");
      setRoles(res.items);
    } catch (err) {
      toast.error("Could not load roles", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/roles", {
        code: values.code.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        name: values.name,
        description: values.description,
        rank: Number(values.rank),
        permissions: [],
      });
      toast.success("Role created", "Now choose what this role is allowed to do.");
      setOpen(false);
      setValues({ code: "", name: "", description: "", rank: "100" });
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const count = (r: RoleRow, key: "users" | "rolePermissions") =>
    r._count?.[key] ?? (key === "users" ? (r.userCount ?? 0) : (r.permissionCount ?? 0));

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Every permission in the application is granted through a role. Roles are fully editable."
        crumbs={[{ label: "Roles & Permissions" }]}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Role
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock label="Loading roles…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.id}
              href={`/roles/${r.id}`}
              className="te-focus group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--te-primary-light)]">
                    <ShieldCheck className="h-4.5 w-4.5 text-[var(--te-primary)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-[var(--te-primary)]">
                      {r.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-slate-400">{r.code}</p>
                  </div>
                </div>
                {r.isSystem && (
                  <Badge tone="neutral">
                    <Lock className="h-3 w-3" /> System
                  </Badge>
                )}
              </div>
              <p className="mb-3 line-clamp-2 min-h-8 text-xs leading-relaxed text-slate-500">{r.description ?? "—"}</p>
              <div className="flex items-center gap-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span>
                  <b className="text-slate-800">{count(r, "users")}</b> user(s)
                </span>
                <span>
                  <b className="text-slate-800">{r.code === "SUPER_ADMIN" ? "All" : count(r, "rolePermissions")}</b>{" "}
                  permission(s)
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-5" title="How roles work">
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>• Permission codes read as <code className="rounded bg-slate-100 px-1">module.action</code> — for example <code className="rounded bg-slate-100 px-1">mom.approve</code>.</li>
          <li>• The eight roles shipped with the system are marked <b>System</b> and cannot be edited or deleted, so a working configuration always exists.</li>
          <li>• Create your own role to grant a different mix of permissions, then assign users to it.</li>
          <li>• Super Admin always holds every permission, including future ones.</li>
        </ul>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New role"
        description="Create the role first, then choose its permissions on the next screen."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button form="role-form" type="submit" loading={busy}>
              Create role
            </Button>
          </>
        }
      >
        <form id="role-form" onSubmit={create} className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Role name" required>
            <Input
              value={values.name}
              onChange={(e) => {
                const name = e.target.value;
                setValues((v) => ({
                  ...v,
                  name,
                  code: v.code || name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""),
                }));
              }}
              placeholder="Site Supervisor"
              required
              autoFocus
            />
          </Field>
          <Field label="Role code" required hint="capital letters and underscores">
            <Input
              value={values.code}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value.toUpperCase() }))}
              placeholder="SITE_SUPERVISOR"
              required
              className="font-mono"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              placeholder="Supervises site work and approves daily reports."
            />
          </Field>
          <Field label="Rank" hint="lower is more senior">
            <Input
              type="number"
              min={1}
              max={999}
              value={values.rank}
              onChange={(e) => setValues((v) => ({ ...v, rank: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
