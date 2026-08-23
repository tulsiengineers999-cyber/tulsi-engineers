import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

/** Every settings key an admin is allowed to write through this endpoint. */
const KNOWN_KEYS = new Set([
  "company.profile",
  "ui.theme",
  "numbering.sequences",
  "files.limits",
  "notifications.rules",
  "otp.policy",
  "pdf.options",
]);

function displayValue(row: { value: unknown; isSecret: boolean }) {
  if (!row.isSecret) return row.value;
  const hasValue = row.value !== null && row.value !== undefined && row.value !== "";
  return hasValue ? "__set__" : "";
}

export async function GET() {
  try {
    await requirePermission("settings.view");

    const rows = await prisma.systemSetting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });

    const groups: Record<
      string,
      { key: string; value: unknown; label: string | null; description: string | null; isSecret: boolean }[]
    > = {};
    for (const row of rows) {
      (groups[row.group] ??= []).push({
        key: row.key,
        value: displayValue(row),
        label: row.label,
        description: row.description,
        isSecret: row.isSecret,
      });
    }

    return ok(groups);
  } catch (e) {
    return fail(e);
  }
}

const entrySchema = z.object({ key: z.string().trim().min(1), value: z.unknown() });
const bodySchema = z.union([entrySchema, z.object({ updates: z.array(entrySchema).min(1) })]);

export async function PUT(req: NextRequest) {
  try {
    const actor = await requirePermission("settings.edit");
    const body = bodySchema.parse(await req.json());
    const updates = "updates" in body ? body.updates : [body];

    const results = [];
    for (const u of updates) {
      if (!KNOWN_KEYS.has(u.key)) throw Errors.validation(`"${u.key}" is not a recognised setting.`);

      const before = await prisma.systemSetting.findUnique({ where: { key: u.key } });
      const row = await setSetting(u.key, u.value, { updatedById: actor.id });
      results.push(row);

      await audit({
        userId: actor.id,
        userName: actor.name,
        action: "SETTINGS_CHANGED",
        module: "settings",
        recordId: row.id,
        recordLabel: row.label ?? u.key,
        oldValue: { [u.key]: before?.isSecret ? "[redacted]" : (before?.value ?? null) },
        newValue: { [u.key]: row.isSecret ? "[redacted]" : row.value },
      });
    }

    return ok(results.length > 1 ? results : results[0]);
  } catch (e) {
    return fail(e);
  }
}
