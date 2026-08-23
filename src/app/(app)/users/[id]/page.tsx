import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can, MODULES, expandPermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid } from "@/components/ui/primitives";
import { UserActions } from "./UserActions";
import { SessionsPanel, PermissionSummary } from "./SessionsPanel";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = { ACTIVE: "success", INACTIVE: "neutral", LOCKED: "danger" } as const;
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", LOCKED: "Locked" } as const;

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("users.view");
  const { id } = await params;

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  });
  if (!user) notFound();

  const codes =
    user.role.code === "SUPER_ADMIN"
      ? expandPermissions(["*"])
      : user.role.rolePermissions.map((rp) => rp.permission.code);

  const grouped = MODULES.map((m) => ({
    module: m.key,
    label: m.label,
    codes: codes.filter((c) => c.startsWith(`${m.key}.`)).sort(),
  })).filter((g) => g.codes.length > 0);

  const [openJobs, completedJobs] = await Promise.all([
    prisma.serviceJob.count({
      where: {
        deletedAt: null,
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        OR: [{ engineerId: id }, { technicianId: id }],
      },
    }),
    prisma.serviceJob.count({
      where: { deletedAt: null, status: { in: ["COMPLETED", "CLOSED"] }, OR: [{ engineerId: id }, { technicianId: id }] },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={user.name}
        description={[user.designation, user.employeeCode].filter(Boolean).join(" · ") || user.email}
        crumbs={[{ label: "Users", href: "/users" }, { label: user.name }]}
        actions={
          <>
            <Badge tone="primary">{user.role.name}</Badge>
            <Badge tone={STATUS_TONE[user.status]} dot>
              {STATUS_LABEL[user.status]}
            </Badge>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Profile">
            <DetailGrid>
              <DetailRow label="Full name">{user.name}</DetailRow>
              <DetailRow label="Employee code">{user.employeeCode}</DetailRow>
              <DetailRow label="Email">{user.email}</DetailRow>
              <DetailRow label="Username">{user.username}</DetailRow>
              <DetailRow label="Mobile">{user.mobile}</DetailRow>
              <DetailRow label="WhatsApp">{user.whatsapp}</DetailRow>
              <DetailRow label="Designation">{user.designation}</DetailRow>
              <DetailRow label="Department">{user.department}</DetailRow>
              <DetailRow label="Field role">
                {[user.isEngineer && "Service engineer", user.isTechnician && "Technician"].filter(Boolean).join(", ") ||
                  "Office based"}
              </DetailRow>
              <DetailRow label="Last sign-in">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</DetailRow>
              <DetailRow label="Password last changed">
                {user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : "Not since the account was created"}
              </DetailRow>
              <DetailRow label="Account created">{formatDateTime(user.createdAt)}</DetailRow>
            </DetailGrid>
          </Card>

          <Card
            title={`Effective permissions — ${user.role.name}`}
            description={
              user.role.code === "SUPER_ADMIN"
                ? "Super Admin always holds every permission in the system."
                : "Granted through this user's role. Change them under Roles & Permissions."
            }
          >
            <PermissionSummary permissions={grouped} />
          </Card>

          <SessionsPanel userId={user.id} />
        </div>

        <div className="space-y-5">
          <Card title="Actions">
            <UserActions
              isSelf={actor.id === user.id}
              permissions={{
                canEdit: can(actor.permissions, "users.edit"),
                canDelete: can(actor.permissions, "users.delete"),
                canManage: can(actor.permissions, "users.manage"),
              }}
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username ?? "",
                employeeCode: user.employeeCode ?? "",
                mobile: user.mobile ?? "",
                whatsapp: user.whatsapp ?? "",
                designation: user.designation ?? "",
                department: user.department ?? "",
                roleId: user.roleId,
                isEngineer: user.isEngineer,
                isTechnician: user.isTechnician,
                status: user.status,
                mustChangePassword: user.mustChangePassword,
              }}
            />
          </Card>

          {(user.isEngineer || user.isTechnician) && (
            <Card title="Workload">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-2xl font-bold text-[var(--te-primary)]">{openJobs}</p>
                  <p className="text-[11px] tracking-wide text-slate-500 uppercase">Open jobs</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-2xl font-bold text-green-700">{completedJobs}</p>
                  <p className="text-[11px] tracking-wide text-slate-500 uppercase">Completed</p>
                </div>
              </div>
            </Card>
          )}

          {user.mustChangePassword && (
            <Card title="Pending action">
              <p className="text-sm text-amber-800">
                This user must choose a new password the next time they sign in.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
