import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { roleSchema } from "@/lib/validation/masters";
import { allPermissionCodes, expandPermissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("roles.view");
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    if (!role) throw Errors.notFound("This role could not be found.");

    const permissions =
      role.code === "SUPER_ADMIN"
        ? allPermissionCodes().map((p) => p.code)
        : role.rolePermissions.map((rp) => rp.permission.code);

    return ok({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      rank: role.rank,
      userCount: role._count.users,
      permissions,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("roles.manage");
    const { id } = await params;
    const body = roleSchema.parse(await req.json());

    const before = await prisma.role.findUnique({ where: { id } });
    if (!before) throw Errors.notFound("This role could not be found.");
    if (before.isSystem) throw Errors.conflict("System roles cannot be edited. Create a new role instead.");

    const wanted = expandPermissions(body.permissions);
    const permRows = wanted.length ? await prisma.permission.findMany({ where: { code: { in: wanted } } }) : [];

    const role = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      return tx.role.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          rank: body.rank,
          rolePermissions: { create: permRows.map((p) => ({ permissionId: p.id })) },
        },
      });
    });

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "UPDATE",
      module: "roles",
      recordId: id,
      recordLabel: role.name,
      oldValue: { name: before.name, rank: before.rank },
      newValue: { name: body.name, rank: body.rank, permissions: wanted },
    });

    return ok(role);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("roles.manage");
    const { id } = await params;

    const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw Errors.notFound("This role could not be found.");
    if (role.isSystem) throw Errors.conflict("System roles cannot be deleted.");
    if (role._count.users > 0) {
      throw Errors.conflict(`${role.name} is assigned to ${role._count.users} user(s) and cannot be deleted. Reassign them to another role first.`);
    }

    await prisma.role.delete({ where: { id } });

    await audit({ userId: actor.id, userName: actor.name, action: "DELETE", module: "roles", recordId: id, recordLabel: role.name });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
