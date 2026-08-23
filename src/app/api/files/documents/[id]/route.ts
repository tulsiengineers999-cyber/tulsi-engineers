import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { deleteFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("photos.delete");
    const { id } = await params;

    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw Errors.notFound("This document could not be found.");

    await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteFile(doc.storageKey);

    await audit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      module: "photos",
      recordId: doc.jobId ?? doc.customerId ?? id,
      description: `Deleted document ${doc.fileName}`,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
