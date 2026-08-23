import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { roleSchema } from "@/lib/validation/masters";
import { allPermissionCodes, expandPermissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    await requirePermission("roles.view");

    const roles = await prisma.role.findMany({
      orderBy: { rank: "asc" },
      include: { _count: { select: { rolePermissions: true, users: true } } },
    });

    const totalPermissions = allPermissionCodes().length;

    return ok(
      roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        rank: r.rank,
        permissionCount: r.code === "SUPER_ADMIN" ? totalPermissions : r._count.rolePermissions,
        userCount: r._count.users,
        createdAt: r.createdAt,
      })),
    );
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("roles.manage");
    const body = roleSchema.parse(await req.json());

    const wanted = expandPermissions(body.permissions);
    const permRows = wanted.length ? await prisma.permission.findMany({ where: { code: { in: wanted } } }) : [];

    const role = await prisma.role.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        rank: body.rank,
        isSystem: false,
        rolePermissions: { create: permRows.map((p) => ({ permissionId: p.id })) },
      },
    });

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "CREATE",
      module: "roles",
      recordId: role.id,
      recordLabel: role.name,
      newValue: { code: body.code, name: body.name, rank: body.rank, permissions: wanted },
    });

    return created(role);
  } catch (e) {
    return fail(e);
  }
}
