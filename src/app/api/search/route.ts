import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireUser } from "@/lib/guard";
import { can } from "@/lib/rbac";

interface Hit {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  subtitle?: string;
  href: string;
}

const CANDIDATE_LIMIT = 20;
const PER_TYPE_LIMIT = 8;

function rank(hits: { id: string; title: string }[], q: string): string[] {
  const lower = q.toLowerCase();
  return [...hits]
    .sort((a, b) => {
      const aExact = a.title.toLowerCase() === lower ? 0 : 1;
      const bExact = b.title.toLowerCase() === lower ? 0 : 1;
      return aExact - bExact;
    })
    .slice(0, PER_TYPE_LIMIT)
    .map((h) => h.id);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return ok([]);

    const hits: Hit[] = [];
    const insensitive = { contains: q, mode: "insensitive" as const };

    if (can(user.permissions, "customers.view")) {
      const customers = await prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { companyName: insensitive },
            { code: insensitive },
            { mobile: { contains: q } },
            { email: insensitive },
            { gstNumber: insensitive },
          ],
        },
        take: CANDIDATE_LIMIT,
        select: { id: true, companyName: true, code: true, city: true },
      });
      const order = rank(customers.map((c) => ({ id: c.id, title: c.companyName })), q);
      for (const id of order) {
        const c = customers.find((x) => x.id === id)!;
        hits.push({
          id: c.id, type: "customer", typeLabel: "Customer", title: c.companyName,
          subtitle: [c.code, c.city].filter(Boolean).join(" · "), href: `/customers/${c.id}`,
        });
      }
    }

    if (can(user.permissions, "sites.view")) {
      const sites = await prisma.site.findMany({
        where: { deletedAt: null, OR: [{ name: insensitive }, { code: insensitive }, { city: insensitive }] },
        take: CANDIDATE_LIMIT,
        select: { id: true, name: true, code: true, city: true, customer: { select: { companyName: true } } },
      });
      const order = rank(sites.map((s) => ({ id: s.id, title: s.name })), q);
      for (const id of order) {
        const s = sites.find((x) => x.id === id)!;
        hits.push({
          id: s.id, type: "site", typeLabel: "Site", title: s.name,
          subtitle: [s.code, s.customer.companyName].filter(Boolean).join(" · "), href: `/sites/${s.id}`,
        });
      }
    }

    if (can(user.permissions, "equipment.view")) {
      const equipment = await prisma.equipment.findMany({
        where: { deletedAt: null, OR: [{ name: insensitive }, { serialNumber: insensitive }, { code: insensitive }] },
        take: CANDIDATE_LIMIT,
        select: { id: true, name: true, code: true, serialNumber: true, site: { select: { name: true } } },
      });
      const order = rank(equipment.map((e) => ({ id: e.id, title: e.name })), q);
      for (const id of order) {
        const e = equipment.find((x) => x.id === id)!;
        hits.push({
          id: e.id, type: "equipment", typeLabel: "Equipment", title: e.name,
          subtitle: [e.code, e.serialNumber ? `Sr. ${e.serialNumber}` : null, e.site.name].filter(Boolean).join(" · "),
          href: `/equipment/${e.id}`,
        });
      }
    }

    if (can(user.permissions, "jobs.view")) {
      const jobs = await prisma.serviceJob.findMany({
        where: { deletedAt: null, jobNumber: insensitive },
        take: CANDIDATE_LIMIT,
        select: {
          id: true, jobNumber: true,
          customer: { select: { companyName: true } },
          site: { select: { name: true } },
        },
      });
      const order = rank(jobs.map((j) => ({ id: j.id, title: j.jobNumber })), q);
      for (const id of order) {
        const j = jobs.find((x) => x.id === id)!;
        hits.push({
          id: j.id, type: "job", typeLabel: "Job", title: j.jobNumber,
          subtitle: `${j.customer.companyName} · ${j.site.name}`, href: `/jobs/${j.id}`,
        });
      }
    }

    if (can(user.permissions, "mom.view")) {
      const moms = await prisma.mom.findMany({
        where: { deletedAt: null, momNumber: insensitive },
        take: CANDIDATE_LIMIT,
        select: { id: true, momNumber: true, customer: { select: { companyName: true } } },
      });
      const order = rank(moms.map((m) => ({ id: m.id, title: m.momNumber })), q);
      for (const id of order) {
        const m = moms.find((x) => x.id === id)!;
        hits.push({
          id: m.id, type: "mom", typeLabel: "MOM", title: m.momNumber,
          subtitle: m.customer.companyName, href: `/mom/${m.id}`,
        });
      }
    }

    if (can(user.permissions, "daily_reports.view")) {
      const reports = await prisma.dailyWorkReport.findMany({
        where: { deletedAt: null, reportNumber: insensitive },
        take: CANDIDATE_LIMIT,
        select: { id: true, reportNumber: true, job: { select: { customer: { select: { companyName: true } } } } },
      });
      const order = rank(reports.map((r) => ({ id: r.id, title: r.reportNumber })), q);
      for (const id of order) {
        const r = reports.find((x) => x.id === id)!;
        hits.push({
          id: r.id, type: "daily_report", typeLabel: "Daily Report", title: r.reportNumber,
          subtitle: r.job.customer.companyName, href: `/daily-reports/${r.id}`,
        });
      }
    }

    if (can(user.permissions, "final_reports.view")) {
      const reports = await prisma.finalServiceReport.findMany({
        where: { deletedAt: null, reportNumber: insensitive },
        take: CANDIDATE_LIMIT,
        select: { id: true, reportNumber: true, customer: { select: { companyName: true } } },
      });
      const order = rank(reports.map((r) => ({ id: r.id, title: r.reportNumber })), q);
      for (const id of order) {
        const r = reports.find((x) => x.id === id)!;
        hits.push({
          id: r.id, type: "final_report", typeLabel: "Final Report", title: r.reportNumber,
          subtitle: r.customer.companyName, href: `/final-reports/${r.id}`,
        });
      }
    }

    if (can(user.permissions, "visits.view")) {
      const visits = await prisma.siteVisit.findMany({
        where: { deletedAt: null, visitNumber: insensitive },
        take: CANDIDATE_LIMIT,
        select: { id: true, visitNumber: true, customer: { select: { companyName: true } } },
      });
      const order = rank(visits.map((v) => ({ id: v.id, title: v.visitNumber })), q);
      for (const id of order) {
        const v = visits.find((x) => x.id === id)!;
        hits.push({
          id: v.id, type: "visit", typeLabel: "Site Visit", title: v.visitNumber,
          subtitle: v.customer.companyName, href: `/visits/${v.id}`,
        });
      }
    }

    if (can(user.permissions, "staff.view")) {
      const staff = await prisma.user.findMany({
        where: { deletedAt: null, OR: [{ name: insensitive }, { employeeCode: insensitive }] },
        take: CANDIDATE_LIMIT,
        select: { id: true, name: true, employeeCode: true, designation: true },
      });
      const order = rank(staff.map((s) => ({ id: s.id, title: s.name })), q);
      for (const id of order) {
        const s = staff.find((x) => x.id === id)!;
        hits.push({
          id: s.id, type: "staff", typeLabel: "Staff", title: s.name,
          subtitle: [s.employeeCode, s.designation].filter(Boolean).join(" · "), href: `/staff/${s.id}`,
        });
      }
    }

    return ok(hits);
  } catch (e) {
    return fail(e);
  }
}
