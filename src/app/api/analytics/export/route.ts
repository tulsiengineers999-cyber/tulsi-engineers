import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { getCompany } from "@/lib/settings";
import { buildReport, parseFilters, REPORT_KEYS, type ReportKey, type ReportResult } from "@/lib/analytics";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(result: ReportResult): string {
  const lines: string[] = [];
  lines.push(result.columns.map((c) => csvEscape(c.label)).join(","));
  for (const row of result.rows) {
    lines.push(result.columns.map((c) => csvEscape(row[c.key])).join(","));
  }
  return lines.join("\r\n");
}

const PRIMARY_ARGB = "FF0F4C81";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("analytics.export");
    const sp = new URL(req.url).searchParams;
    const reportKey = sp.get("report") as ReportKey | null;
    const format = (sp.get("format") ?? "xlsx").toLowerCase();
    if (!reportKey || !REPORT_KEYS.includes(reportKey)) throw Errors.validation("Choose a valid report to export.");
    if (format !== "csv" && format !== "xlsx") throw Errors.validation("Choose CSV or Excel as the export format.");

    const result = await buildReport(reportKey, parseFilters(sp));
    const company = await getCompany();
    const fileBase = `${reportKey}-${new Date().toISOString().slice(0, 10)}`;

    await audit({
      userId: user.id, userName: user.name, action: "EXPORT", module: "analytics",
      recordLabel: result.title, description: `Exported "${result.title}" as ${format.toUpperCase()} (${result.rows.length} rows)`,
    });

    if (format === "csv") {
      const csv = toCsv(result);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.name;
    workbook.created = new Date();
    const sheet = workbook.addWorksheet((result.title || "Report").slice(0, 31));

    const colCount = Math.max(result.columns.length, 1);
    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = company.name;
    titleCell.font = { bold: true, size: 14, color: { argb: PRIMARY_ARGB } };

    sheet.mergeCells(2, 1, 2, colCount);
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = `${result.title} — generated ${new Date().toLocaleString("en-IN")}`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    sheet.addRow([]);

    const headerRow = sheet.addRow(result.columns.map((c) => c.label));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
      cell.alignment = { vertical: "middle" };
    });
    sheet.views = [{ state: "frozen", ySplit: headerRow.number }];

    for (const row of result.rows) {
      const values = result.columns.map((c) => (row[c.key] ?? "") as ExcelJS.CellValue);
      const excelRow = sheet.addRow(values);
      result.columns.forEach((c, i) => {
        if (c.align === "right") excelRow.getCell(i + 1).alignment = { horizontal: "right" };
      });
    }

    result.columns.forEach((c, i) => {
      const column = sheet.getColumn(i + 1);
      const maxLen = Math.max(c.label.length, ...result.rows.map((r) => String(r[c.key] ?? "").length));
      column.width = Math.min(Math.max(maxLen + 2, 12), 48);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
