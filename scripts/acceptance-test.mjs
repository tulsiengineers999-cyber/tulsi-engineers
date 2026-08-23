/**
 * End-to-end acceptance test for the TULSI ENGINEERS workflow.
 *
 * Walks the exact sequence in the acceptance criteria against a running server:
 *   admin login → customer → site → equipment → job → assign engineer →
 *   engineer login → site visit → MOM → photos → submit → PDF → send →
 *   client opens secure link → OTP → confirm → action point → job →
 *   daily work → photos → submit → send → client confirms →
 *   final report → PDF → send → client confirms → history
 *
 * Usage:  node scripts/acceptance-test.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, detail = "") {
  pass++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
}

function bad(label, detail = "") {
  fail++;
  failures.push(`${label} — ${detail}`);
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
}

function step(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Minimal cookie jar so we can hold several sessions at once. */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    clear: () => cookies.clear(),
  };
}

async function call(session, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(session ? { cookie: session.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response (HTML preview, PDF, redirect) */
  }
  return { res, json, text, status: res.status };
}

const admin = jar();
const engineer = jar();
const anonymous = jar();

const state = {};

async function main() {
  console.log(`\n\x1b[1mTULSI ENGINEERS — acceptance test\x1b[0m\n${BASE}\n${"─".repeat(60)}`);

  // ── 0. Health ───────────────────────────────────────────────
  step("0 · Service health");
  {
    const { json } = await call(null, "GET", "/api/health");
    json?.data?.database === "up" ? ok("Database reachable") : bad("Database reachable", JSON.stringify(json?.data));
  }

  // ── 1. Authentication ───────────────────────────────────────
  step("1 · Authentication & access control");
  {
    const { status } = await call(anonymous, "GET", "/api/customers");
    status === 401 ? ok("Unauthenticated API access is rejected", "401") : bad("Unauthenticated API access is rejected", `got ${status}`);
  }
  {
    const { status, json } = await call(admin, "POST", "/api/auth/login", { email: "admin", password: "wrong-password" });
    status === 401 ? ok("Wrong password is rejected", json?.error?.message) : bad("Wrong password is rejected", `got ${status}`);
  }
  {
    const { status, json } = await call(admin, "POST", "/api/auth/login", { email: "admin", password: "Tulsi@2026" });
    if (status === 200 && json?.success) ok("Admin signs in", json.data.roleCode);
    else return bad("Admin signs in", `${status} ${JSON.stringify(json)}`);
  }
  {
    const { json } = await call(admin, "GET", "/api/auth/me");
    json?.data?.permissions?.length ? ok("Session resolves permissions", `${json.data.permissions.length} granted`) : bad("Session resolves permissions");
  }
  {
    const { status } = await call(engineer, "POST", "/api/auth/login", { email: "engineer", password: "Tulsi@2026" });
    status === 200 ? ok("Engineer signs in") : bad("Engineer signs in", `got ${status}`);
  }
  {
    const { status } = await call(engineer, "GET", "/api/users");
    status === 403 ? ok("Engineer is denied the Users module", "403") : bad("Engineer is denied the Users module", `got ${status}`);
  }

  // ── 2. Masters ──────────────────────────────────────────────
  step("2 · Customer, site and equipment");
  {
    const { status, json } = await call(admin, "POST", "/api/customers", {
      companyName: `Acceptance Test Industries ${Date.now()}`,
      contactPerson: "Test Contact",
      mobile: "9825099999",
      whatsapp: "9825099999",
      email: "acceptance@example.test",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382415",
      status: "ACTIVE",
    });
    if (status === 201) {
      state.customerId = json.data.id;
      ok("Customer created", json.data.code);
    } else bad("Customer created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status, json } = await call(admin, "POST", "/api/customers", { companyName: "X" });
    status === 422 ? ok("Invalid customer is rejected with a field error", json?.error?.details?.companyName) : bad("Invalid customer is rejected", `got ${status}`);
  }
  {
    const { status, json } = await call(admin, "POST", "/api/sites", {
      customerId: state.customerId,
      name: "Acceptance Plant",
      address: "GIDC Estate",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382415",
      contactPerson: "Site Contact",
      mobile: "9825088888",
      whatsapp: "9825088888",
      email: "site@example.test",
      status: "ACTIVE",
    });
    if (status === 201) {
      state.siteId = json.data.id;
      ok("Site created", json.data.code);
    } else bad("Site created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status, json } = await call(admin, "POST", "/api/equipment", {
      customerId: state.customerId,
      siteId: state.siteId,
      type: "STEAM_BOILER",
      name: "3 TPH Steam Boiler",
      make: "TULSI ENGINEERS",
      model: "TE-SB-3000",
      serialNumber: `TE/SB/${Date.now()}`,
      capacity: "3000 kg/hr",
      fuelType: "Briquette",
      amcStatus: "UNDER_AMC",
      status: "ACTIVE",
      specifications: { "Design Pressure": "10.54 kg/cm²", "Heating Surface": "88 m²" },
    });
    if (status === 201) {
      state.equipmentId = json.data.id;
      ok("Equipment created", json.data.code);
    } else bad("Equipment created", `${status} ${JSON.stringify(json?.error)}`);
  }

  // ── 3. Service job ──────────────────────────────────────────
  step("3 · Service job and engineer assignment");
  {
    const { json } = await call(admin, "GET", "/api/service-types/options");
    state.serviceTypeId = json?.data?.find((s) => s.name === "Preventive Maintenance")?.id ?? json?.data?.[0]?.id;
    state.serviceTypeId ? ok("Service types available", `${json.data.length} active`) : bad("Service types available");
  }
  {
    const { json } = await call(admin, "GET", "/api/staff/options");
    state.engineerId = json?.data?.find((s) => s.isEngineer)?.id;
    state.technicianId = json?.data?.find((s) => s.isTechnician)?.id;
    state.engineerId ? ok("Field staff available") : bad("Field staff available");
  }
  {
    const { status, json } = await call(admin, "POST", "/api/jobs", {
      customerId: state.customerId,
      siteId: state.siteId,
      equipmentId: state.equipmentId,
      serviceTypeId: state.serviceTypeId,
      priority: "HIGH",
      requestDate: new Date().toISOString(),
      plannedVisitDate: new Date().toISOString(),
      customerRequirement: "Annual preventive maintenance before monsoon shutdown.",
      problemDescription: "Steam pressure dropping intermittently.",
    });
    if (status === 201) {
      state.jobId = json.data.id;
      state.jobNumber = json.data.jobNumber;
      ok("Service job created", json.data.jobNumber);
    } else bad("Service job created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(engineer, "POST", "/api/jobs/" + state.jobId + "/assign", { engineerId: state.engineerId, notify: false });
    status === 403 ? ok("Engineer cannot assign jobs", "403") : bad("Engineer cannot assign jobs", `got ${status}`);
  }
  {
    const { status, json } = await call(admin, "POST", `/api/jobs/${state.jobId}/assign`, {
      engineerId: state.engineerId,
      technicianId: state.technicianId,
      plannedVisitDate: new Date().toISOString(),
      remarks: "Carry gauge glasses and a spare safety valve spring.",
      notify: true,
    });
    status === 200 ? ok("Engineer assigned and notified") : bad("Engineer assigned", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/jobs/${state.jobId}`);
    json?.data?.status === "ASSIGNED" ? ok("Job status advanced to ASSIGNED") : bad("Job status advanced to ASSIGNED", json?.data?.status);
  }

  // ── 4. Site visit (as the engineer) ─────────────────────────
  step("4 · Site visit recorded by the engineer");
  {
    const { status, json } = await call(engineer, "POST", "/api/visits", {
      jobId: state.jobId,
      visitDate: new Date().toISOString(),
      arrivalTime: "10:15",
      departureTime: "16:40",
      engineerId: state.engineerId,
      customerRepresentative: "Site Contact (Boiler Operator)",
      purpose: "Pre-maintenance inspection and scope finalisation",
      problemObserved: "Heavy scale deposition on the water side.",
      initialObservation: "Scale thickness approximately 2-3 mm. Feed water TDS at 4200 ppm.",
      requiredAction: "Chemical descaling, mechanical tube cleaning, safety valve testing.",
    });
    if (status === 201) {
      state.visitId = json.data.id;
      ok("Site visit created", json.data.visitNumber);
    } else bad("Site visit created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(engineer, "POST", `/api/visits/${state.visitId}/submit`);
    status === 200 ? ok("Site visit submitted") : bad("Site visit submitted", `got ${status}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/jobs/${state.jobId}`);
    json?.data?.status === "SITE_VISIT" ? ok("Job advanced to SITE_VISIT") : bad("Job advanced to SITE_VISIT", json?.data?.status);
  }

  // ── 5. Photo upload ─────────────────────────────────────────
  step("5 · Photograph upload");
  {
    // 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("files", new Blob([png], { type: "image/png" }), "before-work.png");
    form.append("category", "BEFORE_WORK");
    form.append("description", "Water side before descaling");
    form.append("jobId", state.jobId);
    form.append("siteVisitId", state.visitId);

    const res = await fetch(`${BASE}/api/photos`, { method: "POST", headers: { cookie: engineer.header() }, body: form });
    const json = await res.json();
    if (res.status === 201) {
      state.photoId = json.data[0].id;
      ok("Photo uploaded and linked to the visit", json.data[0].fileName);
    } else bad("Photo uploaded", `${res.status} ${JSON.stringify(json?.error)}`);
  }
  {
    const res = await fetch(`${BASE}/api/files/${state.photoId}?type=photo`, { headers: { cookie: admin.header() } });
    res.ok ? ok("Photo served through the authorised file route", res.headers.get("content-type")) : bad("Photo served", `got ${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/files/${state.photoId}?type=photo`, { redirect: "manual" });
    res.status === 401 ? ok("Photo is not readable without a session or token", "401") : bad("Photo requires authorisation", `got ${res.status}`);
  }

  // ── 6. MOM ──────────────────────────────────────────────────
  step("6 · Minutes of Meeting with action points");
  {
    const { status, json } = await call(engineer, "POST", "/api/mom", {
      jobId: state.jobId,
      siteVisitId: state.visitId,
      meetingDate: new Date().toISOString(),
      meetingTime: "15:00",
      location: "Conference room, Acceptance Plant",
      purpose: "Finalise scope and shutdown schedule",
      discussionPoints: "Reviewed inspection findings and agreed a four-day shutdown window.",
      technicalObservations: "Scale of 2-3 mm measured. Feed water TDS exceeds the recommended limit.",
      decisionsTaken: "Complete chemical descaling followed by mechanical tube cleaning.",
      participants: [
        { name: "Demo Service Engineer", designation: "Service Engineer", company: "TULSI ENGINEERS", party: "TULSI_ENGINEERS" },
        { name: "Site Contact", designation: "Boiler Operator", company: "Acceptance Test Industries", party: "CUSTOMER" },
      ],
      actionPoints: [
        {
          sequence: 1,
          actionPoint: "Carry out chemical descaling and mechanical tube cleaning",
          responsiblePerson: "Demo Service Engineer",
          responsibleParty: "TULSI_ENGINEERS",
          priority: "HIGH",
          status: "OPEN",
        },
        {
          sequence: 2,
          actionPoint: "Revise the blowdown schedule to twice per shift",
          responsiblePerson: "Site Contact",
          responsibleParty: "CUSTOMER",
          priority: "MEDIUM",
          status: "OPEN",
        },
      ],
    });
    if (status === 201) {
      state.momId = json.data.id;
      state.momNumber = json.data.momNumber;
      ok("MOM created with participants and action points", json.data.momNumber);
    } else bad("MOM created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/mom/${state.momId}`);
    const aps = json?.data?.actionPoints ?? [];
    state.actionPointId = aps.find((a) => a.responsibleParty === "TULSI_ENGINEERS")?.id;
    aps.length === 2 ? ok("Action points are individually trackable", `${aps.length} recorded`) : bad("Action points stored", `${aps.length}`);
  }
  {
    const { status } = await call(engineer, "POST", `/api/mom/${state.momId}/submit`);
    status === 200 ? ok("MOM submitted") : bad("MOM submitted", `got ${status}`);
  }

  // ── 7. PDF ──────────────────────────────────────────────────
  step("7 · PDF generation");
  {
    const res = await fetch(`${BASE}/api/documents/MOM/${state.momId}/preview`, { headers: { cookie: admin.header() } });
    const html = await res.text();
    res.ok && html.includes(state.momNumber)
      ? ok("MOM preview renders with the document number", `${(html.length / 1024).toFixed(0)} KB of HTML`)
      : bad("MOM preview renders", `got ${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/documents/MOM/${state.momId}/pdf`, { headers: { cookie: admin.header() } });
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.includes("pdf") && buf.subarray(0, 4).toString() === "%PDF") {
      state.pdfBytes = buf.length;
      ok("MOM PDF generated", `${(buf.length / 1024).toFixed(0)} KB, ${type}`);
    } else if (res.ok && type.includes("html")) {
      ok("MOM produced printable HTML (no Chromium on this host)", `${(buf.length / 1024).toFixed(0)} KB`);
    } else bad("MOM PDF generated", `${res.status} ${type}`);
  }

  // ── 8. Send to client ───────────────────────────────────────
  step("8 · Sending the MOM to the client");
  {
    const { status, json } = await call(admin, "POST", `/api/documents/MOM/${state.momId}/send`, {
      channels: ["EMAIL", "WHATSAPP"],
      attachPdf: true,
      allowCorrection: true,
      message: "Please review and confirm the minutes of our site meeting.",
    });
    if (status === 200) {
      state.linkUrl = json.data.linkUrl;
      const simulated = json.data.results.filter((r) => r.simulated).length;
      ok("MOM sent over email and WhatsApp", `${json.data.results.length} channel(s), ${simulated} simulated`);
      ok("Secure client link issued", state.linkUrl.replace(BASE, "").slice(0, 28) + "…");
    } else bad("MOM sent", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/mom/${state.momId}`);
    json?.data?.status === "CONFIRMATION_PENDING" ? ok("MOM moved to CONFIRMATION_PENDING") : bad("MOM status after send", json?.data?.status);
  }
  {
    const { json } = await call(admin, "GET", `/api/documents/MOM/${state.momId}/links`);
    const link = json?.data?.[0];
    const leaked = JSON.stringify(json).includes("tokenHash");
    link && !leaked ? ok("Link listing never exposes the token hash") : bad("Link listing hides the token hash");
  }

  // ── 9. Client portal + OTP ──────────────────────────────────
  step("9 · Client portal, OTP and confirmation");
  const token = state.linkUrl.split("/report/")[1];
  {
    const { status, json } = await call(null, "GET", `/api/client/${token}`);
    if (status === 200 && json?.data?.documentNumber === state.momNumber) {
      ok("Client can open the report without signing in", json.data.documentNumber);
    } else bad("Client can open the report", `${status} ${JSON.stringify(json?.error)}`);
    const payload = JSON.stringify(json);
    !payload.includes("passwordHash") && !payload.includes("tokenHash")
      ? ok("Client payload contains no internal secrets")
      : bad("Client payload contains no internal secrets");
  }
  {
    const { status } = await call(null, "GET", `/api/client/${token.slice(0, -4)}zzzz`);
    status === 404 || status === 403 ? ok("A tampered token is rejected", String(status)) : bad("Tampered token rejected", `got ${status}`);
  }
  {
    const res = await fetch(`${BASE}/api/files/${state.photoId}?type=photo&t=${encodeURIComponent(token)}`);
    res.ok ? ok("Photos load for the client using the report token") : bad("Photos load for the client", `got ${res.status}`);
  }
  {
    const { status, json } = await call(null, "POST", `/api/client/${token}/otp`, { channel: "WHATSAPP" });
    if (status === 200) {
      state.otpId = json.data.otpId;
      state.otpCode = json.data.devCode;
      ok("OTP requested", `sent to ${json.data.maskedDestination} via ${json.data.channel}`);
      state.otpCode ? ok("Development OTP surfaced for testing") : bad("Development OTP surfaced", "devCode missing");
    } else bad("OTP requested", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status, json } = await call(null, "POST", `/api/client/${token}/confirm`, { otpId: state.otpId, code: "000000", clientName: "Test Contact" });
    status === 422 || status === 400
      ? ok("A wrong OTP is rejected with attempts remaining", json?.error?.message)
      : bad("Wrong OTP rejected", `got ${status}`);
  }
  {
    const { status, json } = await call(null, "POST", `/api/client/${token}/confirm`, {
      otpId: state.otpId,
      code: state.otpCode,
      clientName: "Test Contact",
    });
    status === 200 ? ok("Client confirms the MOM with a valid OTP") : bad("Client confirms the MOM", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(null, "POST", `/api/client/${token}/confirm`, { otpId: state.otpId, code: state.otpCode });
    status !== 200 ? ok("The same OTP cannot be reused", String(status)) : bad("OTP reuse is blocked", "second use succeeded");
  }
  {
    const { json } = await call(admin, "GET", `/api/mom/${state.momId}`);
    json?.data?.status === "CLIENT_CONFIRMED" && json?.data?.lockedAt
      ? ok("MOM is CLIENT_CONFIRMED and locked")
      : bad("MOM confirmed and locked", `${json?.data?.status}`);
  }
  {
    const { status, json } = await call(admin, "PUT", `/api/mom/${state.momId}`, {
      jobId: state.jobId,
      meetingDate: new Date().toISOString(),
      participants: [],
      actionPoints: [],
    });
    status === 409 ? ok("A confirmed MOM cannot be edited in place", json?.error?.message?.slice(0, 60) + "…") : bad("Confirmed MOM is locked against edits", `got ${status}`);
  }

  // ── 10. Action point → job ──────────────────────────────────
  step("10 · Action point converted into work");
  {
    const { status, json } = await call(admin, "POST", `/api/action-points/${state.actionPointId}/convert`, {
      serviceTypeId: state.serviceTypeId,
      priority: "HIGH",
    });
    if (status === 200 || status === 201) {
      state.spawnedJobNumber = json.data?.jobNumber ?? json.data?.job?.jobNumber;
      ok("Action point converted into a service job", state.spawnedJobNumber);
    } else bad("Action point converted", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(admin, "POST", `/api/action-points/${state.actionPointId}/convert`, { serviceTypeId: state.serviceTypeId });
    status === 409 ? ok("The same action point cannot be converted twice", "409") : bad("Duplicate conversion blocked", `got ${status}`);
  }

  // ── 11. Daily work ──────────────────────────────────────────
  step("11 · Daily work report");
  {
    const { status, json } = await call(engineer, "POST", "/api/daily-reports", {
      jobId: state.jobId,
      reportDate: new Date().toISOString(),
      engineerId: state.engineerId,
      startTime: "07:00",
      endTime: "18:30",
      workHours: 11.5,
      progressPercent: 100,
      workPerformed: "Descaling completed, tubes cleaned, safety valves reset and tested at 9.0 kg/cm².",
      technicalFindings: "Steam raising time reduced from 95 to 62 minutes from cold.",
      materials: [{ name: "Boiler descaling chemical", specification: "Inhibited acid based", quantity: 25, unit: "litre" }],
      spares: [{ name: "Gauge glass", partNumber: "GG-250-TE", make: "Standard", quantity: 2, unit: "no." }],
    });
    if (status === 201) {
      state.dailyId = json.data.id;
      state.dailyNumber = json.data.reportNumber;
      ok("Daily work report created with materials and spares", json.data.reportNumber);
    } else bad("Daily work report created", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(engineer, "POST", `/api/daily-reports/${state.dailyId}/submit`);
    status === 200 ? ok("Daily report submitted") : bad("Daily report submitted", `got ${status}`);
  }
  {
    const { status, json } = await call(admin, "POST", `/api/documents/DAILY_WORK_REPORT/${state.dailyId}/send`, {
      channels: ["EMAIL"],
      attachPdf: true,
      allowCorrection: true,
    });
    if (status === 200) {
      state.dailyToken = json.data.linkUrl.split("/report/")[1];
      ok("Daily report sent to the client");
    } else bad("Daily report sent", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const otp = await call(null, "POST", `/api/client/${state.dailyToken}/otp`, { channel: "EMAIL" });
    const conf = await call(null, "POST", `/api/client/${state.dailyToken}/confirm`, {
      otpId: otp.json.data.otpId,
      code: otp.json.data.devCode,
      clientName: "Test Contact",
    });
    conf.status === 200 ? ok("Client confirms the daily report by OTP") : bad("Client confirms the daily report", `${conf.status} ${JSON.stringify(conf.json?.error)}`);
  }

  // ── 12. Final service report ────────────────────────────────
  step("12 · Final service report");
  {
    const { status, json } = await call(admin, "POST", "/api/final-reports/generate", { jobId: state.jobId });
    if (status === 200 || status === 201) {
      state.finalId = json.data.id;
      state.finalNumber = json.data.reportNumber;
      ok("Final report generated from the job's daily work", json.data.reportNumber);
      json.data.workPerformed?.length > 20 ? ok("Work performed aggregated from daily reports") : bad("Work performed aggregated", "empty");
    } else bad("Final report generated", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status } = await call(admin, "POST", "/api/final-reports/generate", { jobId: state.jobId });
    status === 409 ? ok("A second final report for the same job is refused", "409") : bad("Duplicate final report blocked", `got ${status}`);
  }
  {
    const { status } = await call(admin, "POST", `/api/final-reports/${state.finalId}/submit`);
    status === 200 ? ok("Final report submitted") : bad("Final report submitted", `got ${status}`);
  }
  {
    const res = await fetch(`${BASE}/api/documents/FINAL_SERVICE_REPORT/${state.finalId}/pdf`, { headers: { cookie: admin.header() } });
    const buf = Buffer.from(await res.arrayBuffer());
    res.ok ? ok("Final report PDF generated", `${(buf.length / 1024).toFixed(0)} KB`) : bad("Final report PDF", `got ${res.status}`);
  }
  {
    const { status, json } = await call(admin, "POST", `/api/documents/FINAL_SERVICE_REPORT/${state.finalId}/send`, {
      channels: ["EMAIL", "WHATSAPP"],
      attachPdf: true,
      allowCorrection: false,
    });
    if (status === 200) {
      state.finalToken = json.data.linkUrl.split("/report/")[1];
      ok("Final report sent over both channels");
    } else bad("Final report sent", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const otp = await call(null, "POST", `/api/client/${state.finalToken}/otp`, { channel: "WHATSAPP" });
    const conf = await call(null, "POST", `/api/client/${state.finalToken}/confirm`, {
      otpId: otp.json.data.otpId,
      code: otp.json.data.devCode,
      clientName: "Test Contact",
    });
    conf.status === 200 ? ok("Client gives final confirmation by OTP") : bad("Client final confirmation", `${conf.status} ${JSON.stringify(conf.json?.error)}`);
  }
  {
    const { status } = await call(null, "POST", `/api/client/${state.finalToken}/correction`, { remarks: "Please correct the completion date." });
    status === 403 ? ok("Correction requests are refused when disabled on the link", "403") : bad("Correction toggle honoured", `got ${status}`);
  }

  // ── 13. Versioning ──────────────────────────────────────────
  step("13 · Revision creates a new version");
  {
    const { status, json } = await call(admin, "POST", `/api/documents/MOM/${state.momId}/revise`);
    status === 200 ? ok("Confirmed MOM revised to a new version", `v${json?.data?.version ?? "?"}`) : bad("MOM revised", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/mom/${state.momId}`);
    json?.data?.status === "DRAFT" && json?.data?.version === 2
      ? ok("Revised MOM is a draft again and must be re-confirmed")
      : bad("Revised MOM state", `${json?.data?.status} v${json?.data?.version}`);
  }
  {
    const { status } = await call(null, "GET", `/api/client/${token}`);
    status !== 200 ? ok("The superseded client link is withdrawn", String(status)) : bad("Superseded link withdrawn", "still live");
  }

  // ── 14. Job completion & history ────────────────────────────
  step("14 · Job completion, history and reporting");
  {
    const { status, json } = await call(admin, "POST", `/api/jobs/${state.jobId}/status`, {
      status: "COMPLETED",
      progressPercent: 100,
      remarks: "All work completed and confirmed by the client.",
    });
    status === 200 ? ok("Job marked COMPLETED") : bad("Job marked COMPLETED", `${status} ${JSON.stringify(json?.error)}`);
  }
  {
    const { status, json } = await call(admin, "POST", `/api/jobs/${state.jobId}/status`, { status: "NEW" });
    status === 409 ? ok("An illegal status transition is refused", json?.error?.message?.slice(0, 60)) : bad("Illegal transition refused", `got ${status}`);
  }
  {
    const { json } = await call(admin, "GET", `/api/jobs/${state.jobId}`);
    const d = json?.data;
    const complete =
      d?.visits?.length >= 1 && d?.moms?.length >= 1 && d?.dailyReports?.length >= 1 && d?.finalReports?.length >= 1;
    complete
      ? ok("Job history links visits, MOM, daily reports and the final report", `${d.visits.length}/${d.moms.length}/${d.dailyReports.length}/${d.finalReports.length}`)
      : bad("Job history complete", JSON.stringify({ v: d?.visits?.length, m: d?.moms?.length, dr: d?.dailyReports?.length, fr: d?.finalReports?.length }));
    d?.statusHistory?.length >= 4 ? ok("Status history recorded", `${d.statusHistory.length} transitions`) : bad("Status history recorded");
  }
  {
    const { json } = await call(admin, "GET", `/api/search?q=${encodeURIComponent(state.jobNumber)}`);
    json?.data?.some((h) => h.title.includes(state.jobNumber)) ? ok("Global search finds the job by number") : bad("Global search finds the job");
  }
  {
    const { json } = await call(admin, "GET", "/api/dashboard");
    json?.data?.cards ? ok("Dashboard returns KPI cards and charts", `${Object.keys(json.data.cards).length} cards`) : bad("Dashboard data", JSON.stringify(json?.error));
  }
  {
    const { json } = await call(admin, "GET", "/api/analytics?report=engineer-wise");
    json?.data?.rows ? ok("Analytics report renders", `${json.data.rows.length} row(s)`) : bad("Analytics report", JSON.stringify(json?.error));
  }
  {
    const res = await fetch(`${BASE}/api/analytics/export?report=job-wise&format=csv`, { headers: { cookie: admin.header() } });
    res.ok ? ok("CSV export streams", res.headers.get("content-type")) : bad("CSV export", `got ${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/analytics/export?report=job-wise&format=xlsx`, { headers: { cookie: admin.header() } });
    const buf = Buffer.from(await res.arrayBuffer());
    res.ok && buf.subarray(0, 2).toString() === "PK" ? ok("Excel export streams", `${(buf.length / 1024).toFixed(0)} KB`) : bad("Excel export", `got ${res.status}`);
  }

  // ── 15. Audit, communication history, backup ────────────────
  step("15 · Audit trail, communication history and backup");
  {
    const { json } = await call(admin, "GET", `/api/audit-logs?q=${encodeURIComponent(state.momNumber)}`);
    const actions = new Set((json?.data ?? []).map((a) => a.action));
    actions.size >= 2 ? ok("Audit log records the MOM lifecycle", [...actions].join(", ")) : bad("Audit log records the lifecycle", [...actions].join(","));
  }
  {
    const { json } = await call(admin, "GET", "/api/audit-logs?action=LOGIN_FAILED");
    json?.data?.length ? ok("Failed sign-in attempts are audited", `${json.meta.total} recorded`) : bad("Failed sign-ins audited");
  }
  {
    const { json } = await call(admin, "GET", "/api/email-logs");
    json?.data?.length ? ok("Email history captured", `${json.meta.total} message(s)`) : bad("Email history captured");
  }
  {
    const { json } = await call(admin, "GET", "/api/whatsapp-logs");
    const leaked = JSON.stringify(json).toLowerCase().includes("bearer");
    json?.data?.length && !leaked ? ok("WhatsApp history captured without credentials", `${json.meta.total} message(s)`) : bad("WhatsApp history", leaked ? "token leaked" : "empty");
  }
  {
    const { json } = await call(admin, "GET", "/api/confirmations");
    const confirmed = (json?.data ?? []).filter((c) => c.status === "CONFIRMED").length;
    confirmed >= 3 ? ok("Client confirmations tracked", `${confirmed} confirmed`) : bad("Client confirmations tracked", `${confirmed} confirmed`);
  }
  {
    const res = await fetch(`${BASE}/api/backup`, { headers: { cookie: admin.header() } });
    const text = await res.text();
    const json = JSON.parse(text);
    const leaked = text.includes("passwordHash") || text.includes("codeHash") || text.includes("tokenHash");
    res.ok && !leaked
      ? ok("Backup exports business data with no credentials", `${Object.keys(json.tables ?? json.data?.tables ?? {}).length} tables, ${(text.length / 1024).toFixed(0)} KB`)
      : bad("Backup export", leaked ? "secrets leaked" : `got ${res.status}`);
  }
  {
    const { status } = await call(engineer, "GET", "/api/backup");
    status === 403 ? ok("Engineers cannot download the backup", "403") : bad("Backup is restricted", `got ${status}`);
  }

  // ── 16. Sign out ────────────────────────────────────────────
  step("16 · Session teardown");
  {
    const { status } = await call(admin, "POST", "/api/auth/logout");
    status === 200 ? ok("Admin signs out") : bad("Admin signs out", `got ${status}`);
  }
  {
    const { status } = await call(admin, "GET", "/api/customers");
    status === 401 ? ok("The revoked session no longer works", "401") : bad("Revoked session rejected", `got ${status}`);
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
  if (failures.length) {
    console.log("\n\x1b[31mFailures:\x1b[0m");
    failures.forEach((f) => console.log(`  · ${f}`));
  }
  console.log("");
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error("\n\x1b[31mThe test run crashed:\x1b[0m", err);
  process.exit(1);
});
