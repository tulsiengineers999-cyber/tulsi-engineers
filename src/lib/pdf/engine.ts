import "server-only";
import crypto from "node:crypto";
import chromium from "@sparticuz/chromium";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { renderDocumentHtml, pdfMargins, type PdfDocumentSpec } from "./layout";

let cachedExecutable: string | null | undefined;
let cachedLaunchArgs: string[] | null = null;

/**
 * Serverless hosts (Vercel, AWS Lambda) have no browser on the filesystem.
 * `@sparticuz/chromium` ships a Lambda-compatible build that unpacks itself
 * into /tmp on first use. It is included as a production dependency so the
 * bundled binary is available in Vercel functions.
 *
 *   npm install @sparticuz/chromium
 */
async function serverlessChromium(): Promise<string | null> {
  const looksServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!looksServerless) return null;

  try {
    cachedLaunchArgs = chromium.args;
    return await chromium.executablePath();
  } catch {
    console.warn(
      "[pdf] bundled @sparticuz/chromium could not be initialized — " +
        "set PDF_DRIVER=HTML only if printable HTML is acceptable.",
    );
    return null;
  }
}

/**
 * Locates a Chromium binary: an explicitly configured path, a serverless
 * bundle, or a system install. Returns null when none is available.
 */
async function findChromium(): Promise<string | null> {
  if (cachedExecutable !== undefined) return cachedExecutable;

  const serverless = await serverlessChromium();
  if (serverless) {
    cachedExecutable = serverless;
    return serverless;
  }

  const candidates = [
    env.pdf.chromiumPath,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : "",
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}/Google/Chrome/Application/chrome.exe` : "",
    process.env["PROGRAMFILES(X86)"] ? `${process.env["PROGRAMFILES(X86)"]}/Google/Chrome/Application/chrome.exe` : "",
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}/Microsoft/Edge/Application/msedge.exe` : "",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
  ].filter(Boolean) as string[];

  const fs = await import("node:fs/promises");
  for (const c of candidates) {
    try {
      await fs.access(c);
      cachedExecutable = c;
      return c;
    } catch {
      /* try next */
    }
  }

  // Playwright-style install directories carry a version suffix.
  try {
    const base = "/opt/pw-browsers";
    for (const dir of await fs.readdir(base)) {
      if (!dir.startsWith("chromium")) continue;
      for (const sub of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
        const p = `${base}/${dir}/${sub}`;
        try {
          await fs.access(p);
          cachedExecutable = p;
          return p;
        } catch {
          /* keep looking */
        }
      }
    }
  } catch {
    /* directory absent */
  }

  cachedExecutable = null;
  return null;
}

export interface RenderedPdf {
  buffer: Buffer;
  checksum: string;
  contentType: "application/pdf" | "text/html";
  /** True when Chromium was unavailable and printable HTML was produced instead. */
  fallback: boolean;
}

/**
 * Renders a document specification to PDF. HTML previews use a separate route;
 * download endpoints must never receive HTML in place of a PDF.
 */
export async function renderPdf(spec: PdfDocumentSpec): Promise<RenderedPdf> {
  const html = await renderDocumentHtml(spec);

  if (env.pdf.driver === "HTML") {
    throw new AppError(
      "PDF generation is disabled because PDF_DRIVER=HTML. Set PDF_DRIVER=AUTO or CHROMIUM.",
      500,
      "PDF_UNAVAILABLE",
    );
  }

  const executablePath = await findChromium();
  if (!executablePath) {
    throw new AppError(
      "PDF generation is unavailable because no Chromium binary was found. Set CHROMIUM_PATH to a Chrome/Chromium executable.",
      500,
      "PDF_UNAVAILABLE",
    );
  }

  const puppeteer = (await import("puppeteer-core")).default;
  const margins = await pdfMargins();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: cachedLaunchArgs ?? [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 });
    await page.emulateMediaType("print");
    const data = await page.pdf({
      format: "a4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: margins.headerTemplate,
      footerTemplate: margins.footerTemplate,
      margin: { top: "14mm", bottom: "18mm", left: "12mm", right: "12mm" },
    });
    const buffer = Buffer.from(data);
    return { buffer, checksum: sum(buffer), contentType: "application/pdf", fallback: false };
  } catch (err) {
    console.error("[pdf] render failed", err);
    throw new AppError("The PDF could not be generated. Please try again.", 500, "PDF_FAILED");
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function sum(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

export { renderDocumentHtml };
export type { PdfDocumentSpec };
