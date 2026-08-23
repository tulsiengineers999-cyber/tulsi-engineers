import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  subject: z.string().trim().min(3, "Subject is required").max(300),
  bodyHtml: z.string().trim().min(10, "Email body is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("templates.view");
    const { id } = await params;

    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw Errors.notFound("This email template could not be found.");

    return ok(template);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("templates.edit");
    const { id } = await params;
    const data = updateSchema.parse(await req.json());

    const before = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!before) throw Errors.notFound("This email template could not be found.");

    const template = await prisma.emailTemplate.update({ where: { id }, data });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: actor.id,
        userName: actor.name,
        action: "UPDATE",
        module: "templates",
        recordId: id,
        recordLabel: template.name,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      });
    }

    return ok(template);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("templates.delete");
    const { id } = await params;

    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw Errors.notFound("This email template could not be found.");
    if (template.isSystem) throw Errors.conflict("System templates cannot be deleted. Set it to Inactive instead.");

    await prisma.emailTemplate.delete({ where: { id } });
    await audit({ userId: actor.id, userName: actor.name, action: "DELETE", module: "templates", recordId: id, recordLabel: template.name });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
