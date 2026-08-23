/**
 * Renders every screen in a real browser and reports any that fail.
 * Catches server-component crashes and client-side runtime errors that an
 * API-level test cannot see.
 *
 * Usage:  node scripts/ui-smoke.mjs [baseUrl]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOT_DIR = "/tmp/te-shots";

const EXECUTABLE =
  process.env.CHROMIUM_PATH ||
  "/opt/pw-browsers/chromium/chrome-linux/chrome";

/** [label, path, viewport] — "mobile" pages are checked at phone width. */
const ADMIN_PAGES = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Sites", "/sites"],
  ["Equipment", "/equipment"],
  ["Service jobs", "/jobs"],
  ["New job", "/jobs/new"],
  ["Site visits", "/visits"],
  ["New visit", "/visits/new"],
  ["MOM", "/mom"],
  ["New MOM", "/mom/new"],
  ["Action points", "/action-points"],
  ["Daily reports", "/daily-reports"],
  ["New daily report", "/daily-reports/new"],
  ["Final reports", "/final-reports"],
  ["New final report", "/final-reports/new"],
  ["Photos & documents", "/photos"],
  ["Engineers & technicians", "/staff"],
  ["Client confirmations", "/confirmations"],
  ["Email history", "/email-history"],
  ["WhatsApp history", "/whatsapp-history"],
  ["Analytics", "/analytics"],
  ["Notifications", "/notifications"],
  ["Audit logs", "/audit-logs"],
  ["Users", "/users"],
  ["Roles", "/roles"],
  ["Service master", "/service-master"],
  ["Templates", "/templates"],
  ["System settings", "/settings"],
  ["Backup & data", "/backup"],
  ["Change password", "/account/password"],
];

const FIELD_PAGES = [
  ["Field · my jobs", "/field"],
  ["Field · visits", "/field/visits"],
  ["Field · new visit", "/field/visits/new"],
  ["Field · daily work", "/field/daily"],
  ["Field · new daily report", "/field/daily/new"],
  ["Field · photos", "/field/photos"],
];

let pass = 0;
const problems = [];

function report(label, path, errors) {
  if (errors.length === 0) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(30)} \x1b[90m${path}\x1b[0m`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label.padEnd(30)} \x1b[90m${path}\x1b[0m`);
    errors.forEach((e) => console.log(`      \x1b[31m${e}\x1b[0m`));
    problems.push({ label, path, errors });
  }
}

async function visit(page, label, path, { mobile = false, shot = false } = {}) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Favicon and image 404s in demo data are noise, not defects.
      if (/favicon|net::ERR_ABORTED.*\.(png|jpg|ico)/i.test(text)) return;
      errors.push(`console: ${text.slice(0, 200)}`);
    }
  };
  const onPageError = (err) => errors.push(`runtime: ${String(err).slice(0, 200)}`);
  const onResponse = (res) => {
    const url = res.url();
    if (res.status() >= 500 && url.startsWith(BASE)) {
      errors.push(`${res.status()} from ${url.replace(BASE, "")}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  await page.setViewport(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });

  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 45_000 });
    if (!res || res.status() >= 400) errors.push(`page returned ${res?.status()}`);
    // Give client components a moment to fetch and render.
    await new Promise((r) => setTimeout(r, 1200));

    const bodyText = await page.evaluate(() => document.body.innerText);
    if (/Application error|Unhandled Runtime Error|500 - Internal/i.test(bodyText)) {
      errors.push("error boundary rendered");
    }
    if (bodyText.trim().length < 40) errors.push("page rendered almost nothing");

    // The page must never scroll sideways on a phone.
    if (mobile) {
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      if (overflows) errors.push("horizontal overflow at 390px");
    }

    if (shot) {
      await fs.mkdir(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOT_DIR}/${path.replace(/\W+/g, "_") || "root"}.png`, fullPage: false });
    }
  } catch (err) {
    errors.push(`navigation failed: ${String(err).slice(0, 160)}`);
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);
  report(label, path, errors);
}

async function signIn(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('input[autocomplete="username"]', username);
  await page.type('input[autocomplete="current-password"]', "Tulsi@2026");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45_000 }).catch(() => undefined),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 1500));
}

async function main() {
  console.log(`\n\x1b[1mTULSI ENGINEERS — interface smoke test\x1b[0m\n${BASE}\n${"─".repeat(64)}`);

  const browser = await puppeteer.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    console.log("\n\x1b[1mPublic pages\x1b[0m");
    await visit(page, "Sign in", "/login", { shot: true });
    await visit(page, "Forgot password", "/forgot-password");
    await visit(page, "Sign in (phone)", "/login", { mobile: true });

    console.log("\n\x1b[1mAdmin (signed in as Super Admin)\x1b[0m");
    await signIn(page, "admin");
    for (const [label, path] of ADMIN_PAGES) {
      await visit(page, label, path, { shot: ["/dashboard", "/jobs", "/settings"].includes(path) });
    }

    console.log("\n\x1b[1mAdmin record pages\x1b[0m");
    const ids = JSON.parse(process.env.TE_RECORD_IDS ?? "{}");
    for (const [label, path] of Object.entries(ids)) {
      await visit(page, label, path);
    }

    console.log("\n\x1b[1mAdmin at phone width\x1b[0m");
    for (const path of ["/dashboard", "/jobs", "/customers", "/mom"]) {
      await visit(page, `Mobile ${path}`, path, { mobile: true });
    }

    console.log("\n\x1b[1mField interface (signed in as engineer)\x1b[0m");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
    await signIn(page, "engineer");
    for (const [label, path] of FIELD_PAGES) {
      await visit(page, label, path, { mobile: true, shot: path === "/field" });
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log(`\x1b[1m${pass} pages rendered cleanly, ${problems.length} with problems\x1b[0m`);
  console.log(`Screenshots: ${SHOT_DIR}\n`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error("\n\x1b[31mSmoke test crashed:\x1b[0m", err);
  process.exit(1);
});
