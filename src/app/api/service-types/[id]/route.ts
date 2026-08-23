import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { serviceTypeSchema } from "@/lib/validation/masters";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("masters.edit");
    const { id } = await params;
    const data = serviceTypeSchema.parse(await req.json());

    const before = await prisma.serviceType.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This service type could not be found.");

    const serviceType = await prisma.serviceType.update({ where: { id }, data });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "masters",
        recordId: id,
        recordLabel: serviceType.name,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      });
    }

    return ok(serviceType);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("masters.delete");
    const { id } = await params;

    const serviceType = await prisma.serviceType.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { jobs: true } } },
    });
    if (!serviceType) throw Errors.notFound("This service type could not be found.");
    if (serviceType._count.jobs > 0) {
      throw Errors.conflict(
        `${serviceType.name} is used by ${serviceType._count.jobs} service job(s) and cannot be deleted. Set it to Inactive instead.`,
      );
    }

    await prisma.serviceType.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ userId: actor.id, userName: actor.name, action: "DELETE", module: "masters", recordId: id, recordLabel: serviceType.name });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
