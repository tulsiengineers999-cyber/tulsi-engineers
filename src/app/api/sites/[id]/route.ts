import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { siteSchema } from "@/lib/validation/masters";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("sites.view");
    const { id } = await params;

    const site = await prisma.site.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, code: true, companyName: true, mobile: true, email: true } },
        equipment: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          include: { _count: { select: { jobs: true } } },
        },
        jobs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { serviceType: { select: { name: true } }, engineer: { select: { name: true } } },
        },
        _count: { select: { equipment: true, jobs: true } },
      },
    });
    if (!site) throw Errors.notFound("This site could not be found.");

    return ok(site);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("sites.edit");
    const { id } = await params;
    const data = siteSchema.parse(await req.json());

    const before = await prisma.site.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This site could not be found.");

    const site = await prisma.site.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "sites",
        recordId: id, recordLabel: `${site.code} — ${site.name}`,
        oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(site);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("sites.delete");
    const { id } = await params;

    const site = await prisma.site.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { jobs: true } } },
    });
    if (!site) throw Errors.notFound("This site could not be found.");
    if (site._count.jobs > 0) {
      throw Errors.conflict(
        `${site.name} has ${site._count.jobs} service job(s) and cannot be deleted. Set the site to Inactive instead.`,
      );
    }

    await prisma.site.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "sites",
      recordId: id, recordLabel: `${site.code} — ${site.name}`,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
