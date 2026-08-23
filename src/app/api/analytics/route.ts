import { NextRequest } from "next/server";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { buildReport, parseFilters, REPORT_KEYS, type ReportKey } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("analytics.view");
    const sp = new URL(req.url).searchParams;
    const reportKey = sp.get("report") as ReportKey | null;
    if (!reportKey || !REPORT_KEYS.includes(reportKey)) {
      throw Errors.validation("Choose a valid report to view.");
    }
    const result = await buildReport(reportKey, parseFilters(sp));
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
