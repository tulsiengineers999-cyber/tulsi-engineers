import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { customerSchema } from "@/lib/validation/masters";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("customers.view");
    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
        sites: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          include: { _count: { select: { equipment: true, jobs: true } } },
        },
        equipment: { where: { deletedAt: null }, orderBy: { name: "asc" }, include: { site: { select: { name: true } } } },
        _count: { select: { jobs: true, moms: true, finalReports: true } },
      },
    });
    if (!customer) throw Errors.notFound("This customer could not be found.");

    return ok(customer);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("customers.edit");
    const { id } = await params;
    const data = customerSchema.parse(await req.json());

    const before = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This customer could not be found.");

    const customer = await prisma.customer.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "customers",
        recordId: id, recordLabel: `${customer.code} — ${customer.companyName}`,
        oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(customer);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("customers.delete");
    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { jobs: true } } },
    });
    if (!customer) throw Errors.notFound("This customer could not be found.");
    if (customer._count.jobs > 0) {
      throw Errors.conflict(
        `${customer.companyName} has ${customer._count.jobs} service job(s) and cannot be deleted. Set the customer to Inactive instead.`,
      );
    }

    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "customers",
      recordId: id, recordLabel: `${customer.code} — ${customer.companyName}`,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
