import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http";
import { putFile, getFile } from "@/lib/storage";
import { renderPdf, renderDocumentHtml, type PdfDocumentSpec } from "@/lib/pdf/engine";
import { sha256 } from "@/lib/auth/session";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import {
  DOC_TYPE_LABELS, DOC_STATUS_LABELS, PHOTO_CATEGORY_LABELS,
  ACTION_POINT_STATUS_LABELS, PRIORITY_LABELS, RESPONSIBLE_PARTY_LABELS,
} from "@/lib/masters";
import type { DocumentType, Photo } from "@/generated/prisma";

/* ── Which Prisma model backs each document type ────────── */

export const DOC_MODEL = {
  MOM: "mom",
  DAILY_WORK_REPORT: "dailyWorkReport",
  FINAL_SERVICE_REPORT: "finalServiceReport",
  SITE_VISIT_REPORT: "siteVisit",
} as const;

export const DOC_ROUTE: Record<string, string> = {
  MOM: "/mom",
  DAILY_WORK_REPORT: "/daily-reports",
  FINAL_SERVICE_REPORT: "/final-reports",
  SITE_VISIT_REPORT: "/visits",
};

export const DOC_PERMISSION: Record<string, string> = {
  MOM: "mom",
  DAILY_WORK_REPORT: "daily_reports",
  FINAL_SERVICE_REPORT: "final_reports",
  SITE_VISIT_REPORT: "visits",
};

/* ── Loading a document with everything a PDF needs ─────── */

export interface LoadedDocument {
  docType: DocumentType;
  id: string;
  number: string;
  version: number;
  status: string;
  lockedAt: Date | null;
  confirmedAt: Date | null;
  customerId: string;
  customerName: string;
  siteName: string;
  jobNumber: string;
  contactName: string | null;
  contactMobile: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  spec: PdfDocumentSpec;
}

function photoSections(photos: Photo[], baseUrl: string) {
  if (!photos.length) return [];
  const byCategory = new Map<string, Photo[]>();
  for (const p of photos) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  return [
    {
      title: "Photographs",
      pageBreakBefore: photos.length > 4,
      photos: [...byCategory.entries()].flatMap(([cat, list]) =>
        list.map((p) => ({
          id: p.id,
          url: `${baseUrl}/api/files/${p.id}?type=photo&inline=1`,
          caption: p.description ?? "",
          category: PHOTO_CATEGORY_LABELS[cat] ?? titleCase(cat),
        })),
      ),
    },
  ];
}

export async function loadDocument(docType: DocumentType, id: string): Promise<LoadedDocument> {
  const baseUrl = env.appUrl;

  if (docType === "MOM") {
    const m = await prisma.mom.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true, site: true, job: { include: { serviceType: true, equipment: true } },
        participants: true, actionPoints: { orderBy: { sequence: "asc" } },
        photos: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        createdBy: true,
      },
    });
    if (!m) throw Errors.notFound("This MOM could not be found.");

    return {
      docType, id: m.id, number: m.momNumber, version: m.version, status: m.status,
      lockedAt: m.lockedAt, confirmedAt: m.confirmedAt,
      customerId: m.customerId, customerName: m.customer.companyName, siteName: m.site.name,
      jobNumber: m.job.jobNumber,
      contactName: m.site.contactPerson ?? m.customer.contactPerson,
      contactMobile: m.site.mobile ?? m.customer.mobile,
      contactWhatsapp: m.site.whatsapp ?? m.customer.whatsapp ?? m.site.mobile ?? m.customer.mobile,
      contactEmail: m.site.email ?? m.customer.email,
      spec: {
        documentTitle: "Minutes of Meeting",
        documentNumber: m.momNumber,
        watermark: m.status === "DRAFT" ? "DRAFT" : undefined,
        meta: [
          { label: "Job No.", value: m.job.jobNumber },
          { label: "Meeting Date", value: formatDate(m.meetingDate) },
          { label: "Time", value: m.meetingTime ?? "—" },
          { label: "Version", value: `v${m.version}` },
          { label: "Status", value: DOC_STATUS_LABELS[m.status] ?? m.status },
        ],
        sections: [
          {
            title: "Customer & Site",
            fields: [
              { label: "Customer", value: m.customer.companyName },
              { label: "Site", value: m.site.name },
              { label: "Site Address", value: [m.site.address, m.site.city, m.site.state, m.site.pinCode].filter(Boolean).join(", "), wide: true },
              { label: "Meeting Location", value: m.location },
              { label: "Service Type", value: m.job.serviceType.name },
              { label: "Equipment", value: m.equipmentDetails ?? m.job.equipment?.name },
            ],
          },
          {
            title: "Participants",
            table: {
              columns: ["#", "Name", "Designation", "Company", "Party"],
              widths: ["6%", "28%", "22%", "28%", "16%"],
              rows: m.participants.map((p, i) => [
                i + 1, p.name, p.designation, p.company,
                RESPONSIBLE_PARTY_LABELS[p.party] ?? p.party,
              ]),
            },
          },
          {
            title: "Meeting Record",
            body: [
              { label: "Purpose", text: m.purpose },
              { label: "Discussion Points", text: m.discussionPoints },
              { label: "Technical Observations", text: m.technicalObservations },
              { label: "Problems Identified", text: m.problemsIdentified },
              { label: "Decisions Taken", text: m.decisionsTaken },
            ],
          },
          {
            title: "Action Points",
            table: {
              columns: ["#", "Action Point", "Responsible", "Company", "Due Date", "Priority", "Status"],
              widths: ["5%", "32%", "16%", "17%", "10%", "9%", "11%"],
              rows: m.actionPoints.map((a) => [
                a.sequence, a.actionPoint, a.responsiblePerson,
                a.responsibleCompany ?? RESPONSIBLE_PARTY_LABELS[a.responsibleParty],
                a.dueDate ? formatDate(a.dueDate) : "—",
                PRIORITY_LABELS[a.priority] ?? a.priority,
                ACTION_POINT_STATUS_LABELS[a.status] ?? a.status,
              ]),
            },
          },
          {
            title: "Materials, Pending Points & Recommendations",
            body: [
              { label: "Required Materials", text: m.requiredMaterials },
              { label: "Required Spares", text: m.requiredSpares },
              { label: "Pending Points", text: m.pendingPoints },
              { label: "Recommendations", text: m.recommendations },
              { label: "Client Remarks", text: m.clientRemarks },
            ],
          },
          ...photoSections(m.photos, baseUrl),
        ],
        signatures: [
          { role: "Prepared By", name: m.createdBy?.name ?? "", company: "TULSI ENGINEERS" },
          { role: "For Customer", name: m.site.contactPerson ?? "", company: m.customer.companyName },
        ],
      },
    };
  }

  if (docType === "DAILY_WORK_REPORT") {
    const r = await prisma.dailyWorkReport.findFirst({
      where: { id, deletedAt: null },
      include: {
        job: { include: { customer: true, site: true, serviceType: true, equipment: true } },
        engineer: true, materials: true, spares: true,
        photos: { where: { deletedAt: null }, orderBy: { category: "asc" } },
      },
    });
    if (!r) throw Errors.notFound("This daily work report could not be found.");
    const { job } = r;

    return {
      docType, id: r.id, number: r.reportNumber, version: r.version, status: r.status,
      lockedAt: r.lockedAt, confirmedAt: r.confirmedAt,
      customerId: job.customerId, customerName: job.customer.companyName, siteName: job.site.name,
      jobNumber: job.jobNumber,
      contactName: job.site.contactPerson ?? job.customer.contactPerson,
      contactMobile: job.site.mobile ?? job.customer.mobile,
      contactWhatsapp: job.site.whatsapp ?? job.customer.whatsapp ?? job.site.mobile ?? job.customer.mobile,
      contactEmail: job.site.email ?? job.customer.email,
      spec: {
        documentTitle: "Daily Service Report",
        documentNumber: r.reportNumber,
        watermark: r.status === "DRAFT" ? "DRAFT" : undefined,
        meta: [
          { label: "Job No.", value: job.jobNumber },
          { label: "Report Date", value: formatDate(r.reportDate) },
          { label: "Progress", value: `${r.progressPercent}%` },
          { label: "Version", value: `v${r.version}` },
          { label: "Status", value: DOC_STATUS_LABELS[r.status] ?? r.status },
        ],
        sections: [
          {
            title: "Job Details",
            fields: [
              { label: "Customer", value: job.customer.companyName },
              { label: "Site", value: job.site.name },
              { label: "Equipment", value: job.equipment?.name ?? "—" },
              { label: "Service Type", value: job.serviceType.name },
              { label: "Engineer", value: r.engineer?.name },
              { label: "Technician(s)", value: r.technicianNames },
              { label: "Start Time", value: r.startTime },
              { label: "End Time", value: r.endTime },
              { label: "Work Hours", value: r.workHours ? `${r.workHours} hrs` : "—" },
              { label: "Progress", value: `${r.progressPercent}%` },
            ],
          },
          {
            title: "Work Carried Out",
            body: [
              { label: "Work Performed", text: r.workPerformed },
              { label: "Tools Used", text: r.toolsUsed },
              { label: "Technical Findings", text: r.technicalFindings },
              { label: "Problems Encountered", text: r.problems },
            ],
          },
          ...(r.materials.length
            ? [{
                title: "Materials Used",
                table: {
                  columns: ["#", "Material", "Specification", "Qty", "Unit", "Remarks"],
                  widths: ["5%", "27%", "27%", "10%", "10%", "21%"],
                  rows: r.materials.map((m, i) => [i + 1, m.name, m.specification, m.quantity, m.unit, m.remarks]),
                },
              }]
            : []),
          ...(r.spares.length
            ? [{
                title: "Spares Used",
                table: {
                  columns: ["#", "Spare", "Part No.", "Make", "Qty", "Unit", "Remarks"],
                  widths: ["5%", "24%", "16%", "15%", "8%", "9%", "23%"],
                  rows: r.spares.map((s, i) => [i + 1, s.name, s.partNumber, s.make, s.quantity, s.unit, s.remarks]),
                },
              }]
            : []),
          {
            title: "Status & Next Steps",
            body: [
              { label: "Pending Work", text: r.pendingWork },
              { label: "Next Action", text: r.nextAction },
              { label: "Recommendations", text: r.recommendations },
              { label: "Remarks", text: r.remarks },
            ],
          },
          ...photoSections(r.photos, baseUrl),
        ],
        signatures: [
          { role: "Service Engineer", name: r.engineer?.name ?? "", company: "TULSI ENGINEERS" },
          { role: "For Customer", name: job.site.contactPerson ?? "", company: job.customer.companyName },
        ],
      },
    };
  }

  if (docType === "FINAL_SERVICE_REPORT") {
    const r = await prisma.finalServiceReport.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true, site: true,
        job: {
          include: {
            serviceType: true, equipment: true,
            moms: { where: { deletedAt: null }, select: { momNumber: true } },
            dailyReports: { where: { deletedAt: null }, orderBy: { reportDate: "asc" }, select: { reportNumber: true, reportDate: true, workHours: true, progressPercent: true, workPerformed: true } },
            visits: { where: { deletedAt: null }, select: { visitNumber: true, visitDate: true } },
          },
        },
        photos: { where: { deletedAt: null } },
      },
    });
    if (!r) throw Errors.notFound("This service report could not be found.");
    const { job } = r;

    const jobPhotos = await prisma.photo.findMany({
      where: { jobId: job.id, deletedAt: null, category: { in: ["BEFORE_WORK", "AFTER_WORK", "COMPLETED_WORK", "TESTING"] } },
      orderBy: { category: "asc" },
      take: 12,
    });

    return {
      docType, id: r.id, number: r.reportNumber, version: r.version, status: r.status,
      lockedAt: r.lockedAt, confirmedAt: r.confirmedAt,
      customerId: r.customerId, customerName: r.customer.companyName, siteName: r.site.name,
      jobNumber: job.jobNumber,
      contactName: r.site.contactPerson ?? r.customer.contactPerson,
      contactMobile: r.site.mobile ?? r.customer.mobile,
      contactWhatsapp: r.site.whatsapp ?? r.customer.whatsapp ?? r.site.mobile ?? r.customer.mobile,
      contactEmail: r.site.email ?? r.customer.email,
      spec: {
        documentTitle: "Final Service Report",
        documentNumber: r.reportNumber,
        watermark: r.status === "DRAFT" ? "DRAFT" : undefined,
        meta: [
          { label: "Job No.", value: job.jobNumber },
          { label: "Completion", value: formatDate(r.completionDate) },
          { label: "Version", value: `v${r.version}` },
          { label: "Status", value: DOC_STATUS_LABELS[r.status] ?? r.status },
        ],
        sections: [
          {
            title: "Customer, Site & Equipment",
            fields: [
              { label: "Customer", value: r.customer.companyName },
              { label: "Site", value: r.site.name },
              { label: "Site Address", value: [r.site.address, r.site.city, r.site.state, r.site.pinCode].filter(Boolean).join(", "), wide: true },
              { label: "Equipment", value: job.equipment?.name },
              { label: "Make / Model", value: [job.equipment?.make, job.equipment?.model].filter(Boolean).join(" / ") },
              { label: "Serial Number", value: job.equipment?.serialNumber },
              { label: "Capacity", value: job.equipment?.capacity },
              { label: "Service Type", value: job.serviceType.name },
              { label: "Work Period", value: `${formatDate(r.workStartDate)} to ${formatDate(r.workEndDate)}` },
              { label: "Engineer", value: r.engineerName },
              { label: "Technician(s)", value: r.technicianNames },
            ],
          },
          {
            title: "Reference Documents",
            fields: [
              { label: "Site Visits", value: job.visits.map((v) => `${v.visitNumber} (${formatDate(v.visitDate)})`).join(", ") },
              { label: "MOM Reference", value: job.moms.map((m) => m.momNumber).join(", ") },
              { label: "Daily Reports", value: job.dailyReports.map((d) => d.reportNumber).join(", "), wide: true },
            ],
          },
          {
            title: "Work Performed",
            body: [
              { label: "Scope Executed", text: r.workPerformed },
              { label: "Testing & Commissioning", text: r.testingDetails },
              { label: "Observations", text: r.observations },
            ],
          },
          ...(job.dailyReports.length
            ? [{
                title: "Day-wise Work Summary",
                table: {
                  columns: ["#", "Report No.", "Date", "Hours", "Progress", "Work Performed"],
                  widths: ["4%", "15%", "11%", "8%", "9%", "53%"],
                  rows: job.dailyReports.map((d, i) => [
                    i + 1, d.reportNumber, formatDate(d.reportDate),
                    d.workHours ?? "—", `${d.progressPercent}%`,
                    (d.workPerformed ?? "").slice(0, 300),
                  ]),
                },
              }]
            : []),
          {
            title: "Materials & Spares",
            body: [
              { label: "Materials Consumed", text: r.materialsSummary },
              { label: "Spares Replaced", text: r.sparesSummary },
            ],
          },
          {
            title: "Closure",
            body: [
              { label: "Pending Work", text: r.pendingWork },
              { label: "Recommendations", text: r.recommendations },
              { label: "Final Remarks", text: r.finalRemarks },
            ],
          },
          ...photoSections(r.photos.length ? r.photos : jobPhotos, baseUrl),
        ],
        signatures: [
          { role: "Service Engineer", name: r.engineerName ?? "", company: "TULSI ENGINEERS" },
          { role: "Authorised Signatory", name: "", company: "TULSI ENGINEERS" },
          { role: "For Customer", name: r.site.contactPerson ?? "", company: r.customer.companyName },
        ],
      },
    };
  }

  // SITE_VISIT_REPORT
  const v = await prisma.siteVisit.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true, site: true, engineer: true,
      job: { include: { serviceType: true, equipment: true } },
      photos: { where: { deletedAt: null } },
    },
  });
  if (!v) throw Errors.notFound("This site visit could not be found.");

  return {
    docType, id: v.id, number: v.visitNumber, version: 1, status: v.status,
    lockedAt: null, confirmedAt: null,
    customerId: v.customerId, customerName: v.customer.companyName, siteName: v.site.name,
    jobNumber: v.job.jobNumber,
    contactName: v.site.contactPerson ?? v.customer.contactPerson,
    contactMobile: v.site.mobile ?? v.customer.mobile,
    contactWhatsapp: v.site.whatsapp ?? v.customer.whatsapp,
    contactEmail: v.site.email ?? v.customer.email,
    spec: {
      documentTitle: "Site Visit Report",
      documentNumber: v.visitNumber,
      meta: [
        { label: "Job No.", value: v.job.jobNumber },
        { label: "Visit Date", value: formatDate(v.visitDate) },
        { label: "Status", value: DOC_STATUS_LABELS[v.status] ?? v.status },
      ],
      sections: [
        {
          title: "Visit Details",
          fields: [
            { label: "Customer", value: v.customer.companyName },
            { label: "Site", value: v.site.name },
            { label: "Engineer", value: v.engineer?.name },
            { label: "Technician(s)", value: v.technicianNames },
            { label: "Arrival Time", value: v.arrivalTime },
            { label: "Departure Time", value: v.departureTime },
            { label: "Customer Representative", value: v.customerRepresentative, wide: true },
            { label: "Purpose", value: v.purpose, wide: true },
            { label: "Equipment", value: v.equipmentDetails ?? v.job.equipment?.name, wide: true },
          ],
        },
        {
          title: "Observations",
          body: [
            { label: "Problem Observed", text: v.problemObserved },
            { label: "Initial Observation", text: v.initialObservation },
            { label: "Required Action", text: v.requiredAction },
            { label: "Material Required", text: v.materialRequired },
            { label: "Spare Required", text: v.spareRequired },
            { label: "Site Condition", text: v.siteCondition },
            { label: "Remarks", text: v.remarks },
          ],
        },
        ...photoSections(v.photos, baseUrl),
      ],
      signatures: [
        { role: "Service Engineer", name: v.engineer?.name ?? "", company: "TULSI ENGINEERS" },
        { role: "For Customer", name: v.site.contactPerson ?? "", company: v.customer.companyName },
      ],
    },
  };
}

/* ── PDF generation & caching ───────────────────────────── */

export async function generatePdf(docType: DocumentType, id: string, generatedById?: string) {
  const doc = await loadDocument(docType, id);

  const existing = await prisma.pdfDocument.findUnique({
    where: { docType_recordId_version: { docType, recordId: id, version: doc.version } },
  });
  if (existing) {
    if (existing.fileName.endsWith(".html")) {
      await prisma.pdfDocument.delete({ where: { id: existing.id } }).catch(() => undefined);
    } else {
    try {
      const buffer = await getFile(existing.storageKey);
      return { pdf: existing, buffer, regenerated: false, fallback: existing.fileName.endsWith(".html") };
    } catch {
      await prisma.pdfDocument.delete({ where: { id: existing.id } }).catch(() => undefined);
    }
    }
  }

  const rendered = await renderPdf(doc.spec);
  const ext = rendered.contentType === "application/pdf" ? "pdf" : "html";
  const fileName = `${doc.number.replace(/[\/\\]/g, "-")}-v${doc.version}.${ext}`;
  const stored = await putFile("pdf", fileName, rendered.contentType, rendered.buffer);

  const pdf = await prisma.pdfDocument.create({
    data: {
      docType, recordId: id, recordNumber: doc.number, version: doc.version,
      fileName, storageKey: stored.storageKey, sizeBytes: rendered.buffer.length,
      checksum: rendered.checksum, generatedById: generatedById ?? null,
    },
  });

  return { pdf, buffer: rendered.buffer, regenerated: true, fallback: rendered.fallback };
}

export async function previewHtml(docType: DocumentType, id: string) {
  const doc = await loadDocument(docType, id);
  return renderDocumentHtml(doc.spec);
}

/* ── Secure client links ────────────────────────────────── */

export async function createClientLink(
  docType: DocumentType,
  id: string,
  opts: { createdById?: string; allowCorrection?: boolean } = {},
) {
  const doc = await loadDocument(docType, id);
  const raw = crypto.randomBytes(24).toString("base64url");
  const prefix = crypto.randomBytes(6).toString("hex");

  const link = await prisma.clientReportLink.create({
    data: {
      tokenHash: sha256(raw),
      tokenPrefix: prefix,
      docType, recordId: id, version: doc.version,
      customerId: doc.customerId,
      recipientName: doc.contactName,
      recipientMobile: doc.contactWhatsapp ?? doc.contactMobile,
      recipientEmail: doc.contactEmail,
      allowCorrection: opts.allowCorrection ?? true,
      expiresAt: new Date(Date.now() + env.clientLink.ttlDays * 86_400_000),
      createdById: opts.createdById ?? null,
    },
  });

  return { link, url: `${env.appUrl}/report/${prefix}.${raw}`, doc };
}

/** Resolves a public `<prefix>.<token>` string to a live link row. */
export async function resolveClientLink(token: string) {
  const [prefix, raw] = (token ?? "").split(".");
  if (!prefix || !raw) throw Errors.notFound("This report link is not valid.");

  const link = await prisma.clientReportLink.findUnique({ where: { tokenPrefix: prefix } });
  if (!link) throw Errors.notFound("This report link is not valid.");

  const supplied = Buffer.from(sha256(raw), "hex");
  const stored = Buffer.from(link.tokenHash, "hex");
  if (supplied.length !== stored.length || !crypto.timingSafeEqual(supplied, stored)) {
    throw Errors.notFound("This report link is not valid.");
  }
  if (link.revokedAt) throw Errors.forbidden("This report link has been withdrawn. Please contact us for a new link.");
  if (link.expiresAt < new Date()) {
    throw Errors.forbidden("This report link has expired. Please contact us to request a new link.");
  }
  return link;
}

/* ── Version & lock rules ───────────────────────────────── */

/**
 * Business rule: a client-confirmed document may not be edited in place.
 * Editing creates a new version, clears the confirmation and re-opens the
 * document for confirmation.
 */
export async function assertEditable(docType: DocumentType, id: string) {
  const doc = await loadDocument(docType, id);
  if (doc.status === "CLIENT_CONFIRMED" || doc.lockedAt) {
    throw Errors.conflict(
      `${DOC_TYPE_LABELS[docType]} ${doc.number} has been confirmed by the client and is locked. Use “Revise” to create version ${doc.version + 1}.`,
    );
  }
  return doc;
}

export async function reviseDocument(docType: DocumentType, id: string, userId?: string) {
  const doc = await loadDocument(docType, id);
  if (doc.status !== "CLIENT_CONFIRMED" && !doc.lockedAt) {
    throw Errors.conflict("This document is not locked — you can edit it directly.");
  }

  const data = {
    version: doc.version + 1,
    status: "DRAFT" as const,
    lockedAt: null,
    confirmedAt: null,
    sentAt: null,
    submittedAt: null,
    updatedById: userId ?? null,
  };

  if (docType === "MOM") await prisma.mom.update({ where: { id }, data });
  else if (docType === "DAILY_WORK_REPORT") await prisma.dailyWorkReport.update({ where: { id }, data });
  else if (docType === "FINAL_SERVICE_REPORT") await prisma.finalServiceReport.update({ where: { id }, data });
  else throw Errors.validation("This document type does not support versioning.");

  // Existing links point at the superseded version — withdraw them.
  await prisma.clientReportLink.updateMany({
    where: { docType, recordId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { version: doc.version + 1 };
}

export function documentLabel(docType: DocumentType) {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

export function summariseForMessage(doc: LoadedDocument): string {
  return `${documentLabel(doc.docType)} ${doc.number} for ${doc.customerName} — ${doc.siteName} (Job ${doc.jobNumber}).`;
}

export { formatDateTime };
