"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, LinkButton } from "@/components/ui/primitives";
import { DataTable, type Column, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { UserFormModal } from "./UserFormModal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";

interface UserRow {
  id: string;
  employeeCode: string | null;
  name: string;
  email: string;
  username: string | null;
  mobile: string | null;
  designation: string | null;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  isEngineer: boolean;
  isTechnician: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  role: { id: string; code: string; name: string };
}

interface RoleOption {
  id: string;
  name: string;
}

const STATUS_TONE = { ACTIVE: "success", INACTIVE: "neutral", LOCKED: "danger" } as const;
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", LOCKED: "Locked" } as const;

export default function UsersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    api
      .list<RoleOption>("/api/roles")
      .then((r) => setRoles(r.items))
      .catch(() => setRoles([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<UserRow>(`/api/users${qs({ q, roleId, status, page, pageSize: 25 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load users", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, roleId, status, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      cell: (r) => (
        <span>
          <span className="block font-semibold">{r.name}</span>
          <span className="block text-xs font-normal text-slate-500">{r.email}</span>
        </span>
      ),
    },
    { key: "role", header: "Role", cell: (r) => <Badge tone="primary">{r.role.name}</Badge> },
    {
      key: "field",
      header: "Field role",
      hideOnMobile: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.isEngineer && <Badge tone="info">Engineer</Badge>}
          {r.isTechnician && <Badge tone="info">Technician</Badge>}
          {!r.isEngineer && !r.isTechnician && <span className="text-xs text-slate-400">Office</span>}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-slate-600">
          <span className="block text-xs">{r.employeeCode ?? "—"}</span>
          <span className="block text-xs text-slate-400">{r.mobile ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last sign-in",
      hideOnMobile: true,
      cell: (r) => <span className="text-xs text-slate-500">{r.lastLoginAt ? formatDateTime(r.lastLoginAt) : "Never"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => (
        <span className="flex flex-col items-center gap-1">
          <Badge tone={STATUS_TONE[r.status]} dot>
            {STATUS_LABEL[r.status]}
          </Badge>
          {r.mustChangePassword && <span className="text-[10px] text-amber-700">Password reset pending</span>}
        </span>
      ),
    },
  ];

  const activeFilters = [roleId, status].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in, and what each of them is allowed to do."
        crumbs={[{ label: "Users" }]}
        actions={
          <>
            <LinkButton href="/roles" variant="outline">
              <ShieldCheck className="h-4 w-4" /> Roles &amp; permissions
            </LinkButton>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New User
            </Button>
          </>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setRoleId("");
              setStatus("");
              setPage(1);
            }}
          >
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Search name, email, username, employee code…"
            />
            <FilterSelect
              label="Role"
              value={roleId}
              onChange={(v) => {
                setRoleId(v);
                setPage(1);
              }}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              allLabel="All roles"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "LOCKED", label: "Locked" },
              ]}
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
            rowHref={(r) => `/users/${r.id}`}
            emptyTitle="No users match your filters"
          />
        </div>
      </Card>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />
    </>
  );
}
