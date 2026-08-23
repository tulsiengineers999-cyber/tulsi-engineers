import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { renderDocumentHtml, pdfMargins, type PdfDocumentSpec } from "./layout";

let cachedExecutable: string | null | undefined;
let cachedLaunchArgs: string[] | null = null;

/**
 * Serverless hosts (Vercel, AWS Lambda) have no browser on the filesystem.
 * `@sparticuz/chromium` ships a Lambda-compatible build that unpacks itself
 * into /tmp on first use. It is an optional dependency: install it only where
 * it is needed, and this resolves to null everywhere else.
 *
 *   npm install @sparticuz/chromium
 */
async function serverlessChromium(): Promise<string | null> {
  const looksServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!looksServerless) return null;

  try {
    // The specifier is held in a variable so the bundler and the type checker
    // treat this as optional: the package only needs to exist where it is used.
    const specifier = "@sparticuz/chromium";
    const mod = (await import(specifier)) as {
      default?: { executablePath: (input?: string) => Promise<string>; args: string[] };
      executablePath?: (input?: string) => Promise<string>;
      args?: string[];
    };
    const chromium = (mod.default ?? mod) as {
      executablePath: (input?: string) => Promise<string>;
      args: string[];
    };
    cachedLaunchArgs = chromium.args;
    return await chromium.executablePath();
  } catch {
    console.warn(
      "[pdf] running on a serverless host without @sparticuz/chromium installed — " +
        "documents will be produced as printable HTML. Run `npm install @sparticuz/chromium` " +
        "or set PDF_DRIVER=HTML to silence this.",
    );
    return null;
  }
}

/**
 * Locates a Chromium binary: an explicitly configured path, a serverless
 * bundle, or a system install. Returns null when none is available, in which
 * case the caller falls back to printable HTML.
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
 * Renders a document specification to PDF.
 * If Chromium cannot be located the same markup is returned as a
 * print-ready HTML document so the workflow is never blocked — the caller
 * surfaces this to the user as "printable HTML".
 */
export async function renderPdf(spec: PdfDocumentSpec): Promise<RenderedPdf> {
  const html = await renderDocumentHtml(spec);

  if (env.pdf.driver === "HTML") {
    const buffer = Buffer.from(html, "utf8");
    return { buffer, checksum: sum(buffer), contentType: "text/html", fallback: true };
  }

  const executablePath = await findChromium();
  if (!executablePath) {
    if (env.pdf.driver === "CHROMIUM") {
      throw new AppError(
        "PDF generation is unavailable because no Chromium binary was found. Set CHROMIUM_PATH or switch PDF_DRIVER to HTML.",
        500,
        "PDF_UNAVAILABLE",
      );
    }
    const buffer = Buffer.from(html, "utf8");
    return { buffer, checksum: sum(buffer), contentType: "text/html", fallback: true };
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
