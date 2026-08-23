import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { equipmentSchema } from "@/lib/validation/masters";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("equipment.view");
    const { id } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, code: true, companyName: true, mobile: true, email: true } },
        site: { select: { id: true, code: true, name: true, city: true, state: true } },
        jobs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { serviceType: { select: { name: true } }, engineer: { select: { name: true } } },
        },
        photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!equipment) throw Errors.notFound("This equipment could not be found.");

    return ok(equipment);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("equipment.edit");
    const { id } = await params;
    const data = equipmentSchema.parse(await req.json());

    const before = await prisma.equipment.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This equipment could not be found.");

    const equipment = await prisma.equipment.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "equipment",
        recordId: id, recordLabel: `${equipment.code} — ${equipment.name}`,
        oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(equipment);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("equipment.delete");
    const { id } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { jobs: true } } },
    });
    if (!equipment) throw Errors.notFound("This equipment could not be found.");
    if (equipment._count.jobs > 0) {
      throw Errors.conflict(
        `${equipment.name} has ${equipment._count.jobs} service job(s) and cannot be deleted. Set the equipment to Inactive instead.`,
      );
    }

    await prisma.equipment.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "equipment",
      recordId: id, recordLabel: `${equipment.code} — ${equipment.name}`,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
