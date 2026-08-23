import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { userSchema } from "@/lib/validation/masters";
import { hashPassword } from "@/lib/auth/password";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  username: true,
  mobile: true,
  whatsapp: true,
  designation: true,
  department: true,
  status: true,
  isEngineer: true,
  isTechnician: true,
  mustChangePassword: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
  roleId: true,
  role: { select: { id: true, code: true, name: true, rank: true } },
};

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("users.view");
    const { id } = await params;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: DETAIL_SELECT });
    if (!user) throw Errors.notFound("This user could not be found.");

    return ok(user);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("users.edit");
    const { id } = await params;
    const body = userSchema.parse(await req.json());

    const before = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
    if (!before) throw Errors.notFound("This user could not be found.");

    const isSelf = id === actor.id;
    if (isSelf && body.roleId !== before.roleId) {
      throw Errors.conflict("You cannot change your own role.");
    }
    if (isSelf && before.status === "ACTIVE" && body.status !== "ACTIVE") {
      throw Errors.conflict("You cannot deactivate your own account.");
    }

    const targetRole = body.roleId === before.roleId ? before.role : await prisma.role.findUnique({ where: { id: body.roleId } });
    if (!targetRole) throw Errors.validation("Please choose a valid role.");

    if ((before.role.code === "SUPER_ADMIN" || targetRole.code === "SUPER_ADMIN") && actor.roleCode !== "SUPER_ADMIN") {
      throw Errors.forbidden("Only a Super Admin can edit a Super Admin account.");
    }

    if (before.role.code === "SUPER_ADMIN" && before.status === "ACTIVE" && body.status !== "ACTIVE") {
      const otherActive = await prisma.user.count({
        where: { id: { not: id }, deletedAt: null, status: "ACTIVE", role: { code: "SUPER_ADMIN" } },
      });
      if (otherActive === 0) {
        throw Errors.conflict("This is the last active Super Admin account and cannot be deactivated.");
      }
    }

    let passwordChanged = false;
    const data: Record<string, unknown> = {
      name: body.name,
      email: body.email,
      username: body.username,
      employeeCode: body.employeeCode,
      mobile: body.mobile,
      whatsapp: body.whatsapp,
      designation: body.designation,
      department: body.department,
      roleId: body.roleId,
      isEngineer: body.isEngineer,
      isTechnician: body.isTechnician,
      status: body.status,
      mustChangePassword: body.mustChangePassword,
      updatedById: actor.id,
    };
    if (body.password) {
      data.passwordHash = await hashPassword(body.password);
      data.passwordChangedAt = new Date();
      data.mustChangePassword = true;
      passwordChanged = true;
    }

    const user = await prisma.user.update({ where: { id }, data, select: DETAIL_SELECT });

    if (passwordChanged) {
      await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    const changes = diff(before as unknown as Record<string, unknown>, { ...body } as Record<string, unknown>);
    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CHANGED",
      module: "users",
      recordId: id,
      recordLabel: `${user.name} (${user.email})`,
      description: passwordChanged ? "User updated; password reset and sessions revoked" : "User updated",
      oldValue: changes.oldValue,
      newValue: changes.newValue,
    });

    return ok(user);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("users.delete");
    const { id } = await params;

    if (id === actor.id) throw Errors.conflict("You cannot delete your own account.");

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
    if (!user) throw Errors.notFound("This user could not be found.");

    if (user.role.code === "SUPER_ADMIN" && actor.roleCode !== "SUPER_ADMIN") {
      throw Errors.forbidden("Only a Super Admin can delete a Super Admin account.");
    }
    if (user.role.code === "SUPER_ADMIN") {
      const otherActive = await prisma.user.count({
        where: { id: { not: id }, deletedAt: null, status: "ACTIVE", role: { code: "SUPER_ADMIN" } },
      });
      if (otherActive === 0) {
        throw Errors.conflict("This is the last active Super Admin account and cannot be deleted.");
      }
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE", updatedById: actor.id } }),
      prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CHANGED",
      module: "users",
      recordId: id,
      recordLabel: `${user.name} (${user.email})`,
      description: "User deleted",
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
