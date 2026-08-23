import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { deleteFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("photos.create");
    const { id } = await params;
    const body = (await req.json()) as { category?: string; description?: string };

    const photo = await prisma.photo.update({
      where: { id },
      data: {
        ...(body.category ? { category: body.category as never } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
      },
    });
    return ok(photo);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("photos.delete");
    const { id } = await params;

    const photo = await prisma.photo.findFirst({ where: { id, deletedAt: null } });
    if (!photo) throw Errors.notFound("This photo could not be found.");

    await prisma.photo.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteFile(photo.storageKey);

    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "photos",
      recordId: photo.jobId ?? photo.momId ?? id, description: `Deleted photo ${photo.fileName}`,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
