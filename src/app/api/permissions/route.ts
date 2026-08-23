import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { ACTIONS, MODULES, allPermissionCodes } from "@/lib/rbac";

/**
 * Full permission catalogue grouped by module, joined with the DB rows so the
 * front-end permission matrix never has to hard-code a single module or action.
 */
export async function GET() {
  try {
    await requirePermission("roles.view");

    const catalogue = allPermissionCodes();
    const rows = await prisma.permission.findMany();
    const byCode = new Map(rows.map((r) => [r.code, r]));

    const modules = MODULES.map((m) => ({
      key: m.key,
      label: m.label,
      permissions: catalogue
        .filter((p) => p.module === m.key)
        .map((p) => ({ id: byCode.get(p.code)?.id ?? null, code: p.code, action: p.action, label: p.label })),
    })).filter((m) => m.permissions.length > 0);

    return ok({ modules, actions: ACTIONS });
  } catch (e) {
    return fail(e);
  }
}
