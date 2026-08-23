import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import type { AuditAction, Prisma } from "@/generated/prisma";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("audit.export");
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    const userId = sp.get("userId");
    const moduleFilter = sp.get("module");
    const action = sp.get("action");
    const from = sp.get("from");
    const to = sp.get("to");

    const and: Prisma.AuditLogWhereInput[] = [];
    if (userId) and.push({ userId });
    if (moduleFilter) and.push({ module: moduleFilter });
    if (action) and.push({ action: action as AuditAction });
    if (from || to) {
      and.push({
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { userName: { contains: q, mode: "insensitive" } },
          { recordLabel: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 20000 });

    const header = ["When", "User", "Action", "Module", "Record", "Description", "IP Address"];
    const lines = [header.map(csvEscape).join(",")];
    for (const l of logs) {
      lines.push(
        [
          formatDateTime(l.createdAt),
          l.userName ?? "System",
          l.action,
          l.module,
          l.recordLabel ?? "",
          l.description ?? "",
          l.ipAddress ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    await audit({
      userId: user.id, userName: user.name, action: "EXPORT", module: "audit",
      description: `Exported the audit log (${logs.length} rows)`,
    });

    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
