import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { PermissionMatrix } from "./PermissionMatrix";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("roles.view");
  const { id } = await params;

  const role = await prisma.role.findUnique({ where: { id }, select: { id: true, name: true, description: true } });
  if (!role) notFound();

  return (
    <>
      <PageHeader
        title={role.name}
        description={role.description ?? "Choose exactly what this role is allowed to do."}
        crumbs={[{ label: "Roles & Permissions", href: "/roles" }, { label: role.name }]}
      />
      <PermissionMatrix roleId={role.id} canManage={can(user.permissions, "roles.manage")} />
    </>
  );
}
