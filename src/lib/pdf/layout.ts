import "server-only";
import { getCompany, getSetting } from "@/lib/settings";
import { formatCompanyAddress } from "@/lib/company";
import { photoDataUri } from "./images";

export interface PdfSection {
  title?: string;
  /** Rendered as a definition grid. */
  fields?: { label: string; value?: string | null; wide?: boolean }[];
  /** Rendered as free-flowing paragraphs preserving line breaks. */
  body?: { label?: string; text?: string | null }[];
  /** Rendered as a bordered table. */
  table?: { columns: string[]; rows: (string | number | null | undefined)[][]; widths?: string[] };
  /**
   * Rendered as a photo grid. `id` is the Photo record — the renderer embeds
   * the image itself so the document prints without a session. `url` is kept
   * for consumers that need to link back to the authorised file route.
   */
  photos?: { id: string; url: string; caption?: string; category?: string }[];
  pageBreakBefore?: boolean;
}

export interface PdfDocumentSpec {
  documentTitle: string;
  documentNumber: string;
  /** Small key/value block printed at the top-right of page 1. */
  meta: { label: string; value: string }[];
  sections: PdfSection[];
  /** Signature blocks at the end. */
  signatures?: { role: string; name?: string; company?: string }[];
  confirmation?: {
    status: string;
    clientName?: string | null;
    clientMobile?: string | null;
    confirmedAt?: string | null;
    channel?: string | null;
    verified: boolean;
    version: number;
  };
  watermark?: string;
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (v: unknown): string => esc(v).replace(/\n/g, "<br/>");

/**
 * Builds a complete, self-contained A4 HTML document.
 * Chromium prints this to PDF; the same markup is also served as an
 * inline preview so what the client sees is exactly what is printed.
 */
export async function renderDocumentHtml(spec: PdfDocumentSpec): Promise<string> {
  const company = await getCompany();
  const opts = await getSetting<{
    showLogo: boolean;
    showSignature: boolean;
    showPhotos: boolean;
    photosPerRow: number;
    pageSize: string;
    showTerms: boolean;
  }>("pdf.options", { showLogo: true, showSignature: true, showPhotos: true, photosPerRow: 2, pageSize: "A4", showTerms: true });

  const address = formatCompanyAddress(company);

  // Photographs are embedded as data URIs. Chromium prints without a session
  // cookie and the client portal serves this markup to an unauthenticated
  // visitor, so a linked image would come back 401 and print as a blank frame.
  const photoSources = new Map<string, string>();
  if (opts.showPhotos) {
    const ids = [...new Set(spec.sections.flatMap((s) => s.photos?.map((p) => p.id) ?? []))];
    await Promise.all(
      ids.map(async (id) => {
        const uri = await photoDataUri(id);
        if (uri) photoSources.set(id, uri);
      }),
    );
  }

  const header = `
  <header class="doc-header">
    <div class="brand">
      ${opts.showLogo && company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" alt=""/>` : `<div class="logo-fallback">TE</div>`}
      <div class="brand-text">
        <h1>${esc(company.name)}</h1>
        <p class="tagline">${esc(company.tagline)}</p>
        <p class="contact">
          ${address ? `${esc(address)}<br/>` : ""}
          ${[company.phone, company.mobile].filter(Boolean).map(esc).join(" · ")}
          ${company.email ? ` · ${esc(company.email)}` : ""}
          ${company.website ? ` · ${esc(company.website)}` : ""}
          ${company.gstNumber ? `<br/>GSTIN: ${esc(company.gstNumber)}` : ""}
        </p>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${esc(spec.documentTitle)}</div>
      <div class="doc-number">${esc(spec.documentNumber)}</div>
      <table class="meta-table">
        ${spec.meta.map((m) => `<tr><td>${esc(m.label)}</td><td><b>${esc(m.value)}</b></td></tr>`).join("")}
      </table>
    </div>
  </header>`;

  const renderSection = (s: PdfSection) => {
    const parts: string[] = [];
    if (s.title) parts.push(`<h2 class="section-title">${esc(s.title)}</h2>`);

    if (s.fields?.length) {
      parts.push(
        `<table class="field-grid">${chunk(s.fields, 2)
          .map(
            (pair) =>
              `<tr>${pair
                .map(
                  (f) =>
                    `<td class="${f.wide ? "wide" : ""}" ${f.wide ? 'colspan="3"' : ""}>
                       <span class="fl">${esc(f.label)}</span>
                       <span class="fv">${nl2br(f.value) || "—"}</span>
                     </td>`,
                )
                .join("")}${pair.length === 1 && !pair[0].wide ? "<td></td>" : ""}</tr>`,
          )
          .join("")}</table>`,
      );
    }

    if (s.body?.length) {
      for (const b of s.body) {
        if (!b.text) continue;
        parts.push(
          `<div class="body-block">${b.label ? `<div class="bl">${esc(b.label)}</div>` : ""}<div class="bt">${nl2br(b.text)}</div></div>`,
        );
      }
    }

    if (s.table?.rows.length) {
      parts.push(`
        <table class="data-table">
          <thead><tr>${s.table.columns.map((c, i) => `<th ${s.table?.widths?.[i] ? `style="width:${s.table.widths[i]}"` : ""}>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${s.table.rows
            .map((r) => `<tr>${r.map((cell) => `<td>${nl2br(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody>
        </table>`);
    }

    if (opts.showPhotos && s.photos?.length) {
      const per = Math.max(1, Math.min(4, opts.photosPerRow || 2));
      const figures = s.photos
        .map((p) => {
          const src = photoSources.get(p.id);
          if (!src) return "";
          return `<figure>
                    <img src="${src}" alt=""/>
                    <figcaption>${p.category ? `<b>${esc(p.category)}</b><br/>` : ""}${esc(p.caption ?? "")}</figcaption>
                  </figure>`;
        })
        .join("");
      if (figures) {
        parts.push(`<div class="photo-grid" style="grid-template-columns:repeat(${per},1fr)">${figures}</div>`);
      }
    }

    return `<section class="${s.pageBreakBefore ? "page-break" : ""}">${parts.join("")}</section>`;
  };

  const confirmation = spec.confirmation
    ? `<section class="confirmation ${spec.confirmation.verified ? "ok" : "pending"}">
         <h2 class="section-title">Client Confirmation</h2>
         <table class="field-grid">
           <tr>
             <td><span class="fl">Status</span><span class="fv">${esc(spec.confirmation.status)}</span></td>
             <td><span class="fl">Document Version</span><span class="fv">v${spec.confirmation.version}</span></td>
           </tr>
           <tr>
             <td><span class="fl">Confirmed By</span><span class="fv">${esc(spec.confirmation.clientName ?? "—")}</span></td>
             <td><span class="fl">Mobile</span><span class="fv">${esc(spec.confirmation.clientMobile ?? "—")}</span></td>
           </tr>
           <tr>
             <td><span class="fl">Confirmed On</span><span class="fv">${esc(spec.confirmation.confirmedAt ?? "—")}</span></td>
             <td><span class="fl">Verification</span><span class="fv">${spec.confirmation.verified ? `OTP verified via ${esc(spec.confirmation.channel ?? "—")}` : "Not yet verified"}</span></td>
           </tr>
         </table>
       </section>`
    : "";

  const signatures =
    opts.showSignature && spec.signatures?.length
      ? `<section class="signatures">
           ${spec.signatures
             .map(
               (s) => `<div class="sig">
                         ${company.signatureUrl && s.company === company.name ? `<img class="sig-img" src="${esc(company.signatureUrl)}" alt=""/>` : `<div class="sig-space"></div>`}
                         <div class="sig-line"></div>
                         <div class="sig-name">${esc(s.name ?? "")}</div>
                         <div class="sig-role">${esc(s.role)}</div>
                         <div class="sig-company">${esc(s.company ?? "")}</div>
                       </div>`,
             )
             .join("")}
         </section>`
      : "";

  const terms =
    opts.showTerms && company.pdfTerms
      ? `<section class="terms"><h2 class="section-title">Terms &amp; Conditions</h2><div class="bt">${nl2br(company.pdfTerms)}</div></section>`
      : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(spec.documentNumber)} — ${esc(spec.documentTitle)}</title>
<style>
  @page { size: ${opts.pageSize || "A4"}; margin: 14mm 12mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10.5px; color:#111827; margin:0; line-height:1.5; }
  ${spec.watermark ? `body::before { content:"${esc(spec.watermark)}"; position:fixed; inset:0; display:flex; align-items:center; justify-content:center; font-size:80px; font-weight:800; color:rgba(15,76,129,.07); transform:rotate(-30deg); z-index:0; pointer-events:none; }` : ""}
  .doc-header { display:flex; justify-content:space-between; gap:16px; border-bottom:2.5px solid #0F4C81; padding-bottom:10px; margin-bottom:14px; }
  .brand { display:flex; gap:10px; align-items:flex-start; max-width:62%; }
  .logo { width:52px; height:52px; object-fit:contain; }
  .logo-fallback { width:46px;height:46px;border-radius:6px;background:#F26522;color:#fff;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center; }
  .brand-text h1 { margin:0; font-size:17px; letter-spacing:.4px; color:#0F4C81; font-weight:800; }
  .tagline { margin:2px 0 4px; font-size:8.5px; color:#475569; line-height:1.35; }
  .contact { margin:0; font-size:8px; color:#64748b; line-height:1.45; }
  .doc-meta { text-align:right; min-width:190px; }
  .doc-title { font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#0F4C81; }
  .doc-number { font-size:11px; font-weight:700; color:#F26522; margin:1px 0 6px; }
  .meta-table { margin-left:auto; border-collapse:collapse; font-size:8.5px; }
  .meta-table td { padding:1px 0 1px 8px; color:#64748b; text-align:right; }
  .meta-table td b { color:#111827; }
  section { position:relative; z-index:1; margin-bottom:11px; }
  .page-break { page-break-before: always; }
  .section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.9px; color:#0F4C81;
                   background:#EEF4FA; border-left:3px solid #F26522; padding:4px 8px; margin:0 0 6px; }
  .field-grid { width:100%; border-collapse:collapse; }
  .field-grid td { vertical-align:top; padding:3px 8px 3px 0; width:50%; }
  .fl { display:block; font-size:7.5px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; font-weight:700; }
  .fv { display:block; font-size:10px; color:#111827; }
  .body-block { margin-bottom:6px; }
  .bl { font-size:7.5px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; font-weight:700; margin-bottom:1px; }
  .bt { font-size:10px; text-align:justify; }
  .data-table { width:100%; border-collapse:collapse; margin:4px 0 8px; }
  .data-table th { background:#0F4C81; color:#fff; font-size:8px; text-transform:uppercase; letter-spacing:.4px;
                   padding:4px 6px; text-align:left; border:.5px solid #0F4C81; }
  .data-table td { border:.5px solid #cbd5e1; padding:4px 6px; font-size:9.5px; vertical-align:top; }
  .data-table tbody tr:nth-child(even) td { background:#f8fafc; }
  .photo-grid { display:grid; gap:8px; margin-top:4px; }
  .photo-grid figure { margin:0; border:.5px solid #cbd5e1; border-radius:3px; overflow:hidden; page-break-inside:avoid; }
  .photo-grid img { width:100%; height:150px; object-fit:cover; display:block; }
  .photo-grid figcaption { font-size:7.5px; padding:3px 5px; color:#475569; background:#f8fafc; }
  .confirmation { border:1px solid #cbd5e1; border-radius:4px; padding:8px; page-break-inside:avoid; }
  .confirmation.ok { border-color:#86efac; background:#f0fdf4; }
  .confirmation.pending { border-color:#fcd34d; background:#fffbeb; }
  .signatures { display:flex; gap:24px; justify-content:space-between; margin-top:22px; page-break-inside:avoid; }
  .sig { flex:1; text-align:center; }
  .sig-img { height:38px; object-fit:contain; margin-bottom:2px; }
  .sig-space { height:38px; }
  .sig-line { border-top:.7px solid #475569; margin-bottom:3px; }
  .sig-name { font-size:9.5px; font-weight:700; }
  .sig-role { font-size:8px; color:#64748b; }
  .sig-company { font-size:8px; color:#64748b; }
  .terms .bt { font-size:8.5px; color:#475569; }
  .doc-footer { position:fixed; bottom:6mm; left:0; right:0; font-size:7.5px; color:#94a3b8;
                border-top:.5px solid #e2e8f0; padding-top:3px; display:flex; justify-content:space-between; }
</style></head>
<body>
  ${header}
  ${spec.sections.map(renderSection).join("")}
  ${confirmation}
  ${signatures}
  ${terms}
</body></html>`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  let bucket: T[] = [];
  for (const item of arr) {
    const wide = (item as { wide?: boolean }).wide;
    if (wide) {
      if (bucket.length) {
        out.push(bucket);
        bucket = [];
      }
      out.push([item]);
      continue;
    }
    bucket.push(item);
    if (bucket.length === size) {
      out.push(bucket);
      bucket = [];
    }
  }
  if (bucket.length) out.push(bucket);
  return out;
}

/** Footer/header templates handed to Chromium so "Page X of Y" is accurate. */
export async function pdfMargins() {
  const company = await getCompany();
  return {
    headerTemplate: `<div style="font-size:7px;width:100%;padding:0 12mm;color:#94a3b8;"></div>`,
    footerTemplate: `<div style="font-size:7px;width:100%;padding:0 12mm;color:#94a3b8;display:flex;justify-content:space-between;border-top:.5px solid #e2e8f0;padding-top:3px;">
        <span>${esc(company.pdfFooterNote)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
  };
}
