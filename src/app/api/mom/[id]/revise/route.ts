import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { reviseDocument } from "@/lib/services/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("mom.edit");
    const { id } = await params;

    const mom = await prisma.mom.findFirst({ where: { id, deletedAt: null } });
    if (!mom) throw Errors.notFound("This MOM could not be found.");

    const result = await reviseDocument("MOM", id, user.id);

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "mom",
      recordId: id, recordLabel: mom.momNumber,
      description: `Revised to version ${result.version}`,
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
