import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { formatDate } from "@/lib/format";

interface SummaryLine {
  name: string;
  detail?: string | null;
  unit?: string | null;
  quantity: number;
}

/** Deduplicates by name (case-insensitive) and sums quantities, for a plain-text summary line. */
function summariseLines(items: SummaryLine[]): string | undefined {
  const byName = new Map<string, SummaryLine>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) existing.quantity += item.quantity;
    else byName.set(key, { ...item });
  }
  if (!byName.size) return undefined;
  return [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((it) => `${it.name}${it.detail ? ` (${it.detail})` : ""} — ${it.quantity}${it.unit ? ` ${it.unit}` : ""}`)
    .join("\n");
}

/**
 * Builds a draft Final Service Report by aggregating everything already
 * recorded against the job — its daily work reports, materials and spares —
 * so the office only has to review and polish rather than retype.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("final_reports.create");
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) throw Errors.validation("Select a job to generate the final service report from.");

    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, deletedAt: null },
      include: { engineer: { select: { name: true } } },
    });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const existing = await prisma.finalServiceReport.findFirst({ where: { jobId, deletedAt: null } });
    if (existing) {
      throw Errors.conflict(
        `A final service report (${existing.reportNumber}) already exists for this job. Open it instead, or use “Revise” if it needs changes.`,
      );
    }

    const dailyReports = await prisma.dailyWorkReport.findMany({
      where: { jobId, deletedAt: null },
      orderBy: { reportDate: "asc" },
      include: { engineer: { select: { name: true } }, materials: true, spares: true },
    });

    const workStartDate = dailyReports[0]?.reportDate ?? job.plannedVisitDate ?? undefined;
    const workEndDate = dailyReports[dailyReports.length - 1]?.reportDate ?? job.targetCompletionDate ?? undefined;

    const engineerNames = [...new Set(dailyReports.map((d) => d.engineer?.name).filter((n): n is string => Boolean(n)))];
    const engineerName = engineerNames.join(", ") || job.engineer?.name || undefined;

    const technicianSet = new Set<string>();
    for (const d of dailyReports) {
      (d.technicianNames ?? "").split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => technicianSet.add(n));
    }
    const technicianNames = [...technicianSet].join(", ") || undefined;

    const workPerformed =
      dailyReports
        .filter((d) => d.workPerformed)
        .map((d) => `${formatDate(d.reportDate)}: ${d.workPerformed}`)
        .join("\n\n") || undefined;

    const materialsSummary = summariseLines(
      dailyReports.flatMap((d) =>
        d.materials.map((m) => ({ name: m.name, detail: m.specification, unit: m.unit, quantity: m.quantity })),
      ),
    );
    const sparesSummary = summariseLines(
      dailyReports.flatMap((d) =>
        d.spares.map((s) => ({
          name: s.name, detail: [s.partNumber, s.make].filter(Boolean).join(" / ") || undefined, unit: s.unit, quantity: s.quantity,
        })),
      ),
    );

    const last = dailyReports[dailyReports.length - 1];
    const reportNumber = await nextNumber("FSR");

    const report = await prisma.finalServiceReport.create({
      data: {
        reportNumber,
        jobId: job.id,
        customerId: job.customerId,
        siteId: job.siteId,
        workStartDate,
        workEndDate,
        engineerName,
        technicianNames,
        workPerformed,
        materialsSummary,
        sparesSummary,
        testingDetails: last?.technicalFindings ?? undefined,
        observations: last?.problems ?? undefined,
        recommendations: last?.recommendations ?? undefined,
        pendingWork: last?.pendingWork ?? undefined,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "final_reports",
      recordId: report.id, recordLabel: report.reportNumber,
      description: `Generated from job ${job.jobNumber} (${dailyReports.length} daily report(s))`,
    });

    return created(report);
  } catch (e) {
    return fail(e);
  }
}
