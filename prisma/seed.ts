/**
 * Seeds roles, permissions, users, masters, templates, settings and a complete
 * realistic demo workflow (customer → site → equipment → job → visit → MOM →
 * action points → daily report → final report → client confirmation).
 *
 *   npm run db:seed          # idempotent: safe to re-run
 *   npm run db:seed -- --demo-only
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";
import { allPermissionCodes, DEFAULT_ROLES, expandPermissions } from "../src/lib/rbac";
import { SERVICE_TYPES } from "../src/lib/masters";
import { EMAIL_TEMPLATES, WHATSAPP_TEMPLATES } from "../src/lib/services/templates";
import { DEFAULT_COMPANY, DEFAULT_THEME } from "../src/lib/company";

const prisma = new PrismaClient();
const log = (msg: string) => console.log(`  ${msg}`);

async function seedPermissions() {
  const codes = allPermissionCodes();
  for (const p of codes) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: { code: p.code, module: p.module, action: p.action, label: p.label },
      update: { module: p.module, action: p.action, label: p.label },
    });
  }
  log(`permissions: ${codes.length}`);
}

async function seedRoles() {
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, description: r.description, rank: r.rank, isSystem: true },
      update: { name: r.name, description: r.description, rank: r.rank, isSystem: true },
    });

    const wanted = expandPermissions(r.permissions);
    const perms = await prisma.permission.findMany({ where: { code: { in: wanted } } });
    const existing = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const existingIds = new Set(existing.map((e) => e.permissionId));

    const toAdd = perms.filter((p) => !existingIds.has(p.id));
    if (toAdd.length) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }
  log(`roles: ${DEFAULT_ROLES.length}`);
}

async function seedUsers() {
  const roles = await prisma.role.findMany();
  const byCode = Object.fromEntries(roles.map((r) => [r.code, r.id]));
  const pw = await bcrypt.hash("Tulsi@2026", 12);

  const people = [
    { employeeCode: "TE-001", name: "System Administrator", email: "admin@tulsiengineers.com", username: "admin", role: "SUPER_ADMIN", designation: "Proprietor", mobile: "9876500001" },
    { employeeCode: "TE-002", name: "Service Manager", email: "manager@tulsiengineers.com", username: "manager", role: "SERVICE_MANAGER", designation: "Service Manager", mobile: "9876500002" },
    { employeeCode: "TE-003", name: "Demo Service Engineer", email: "engineer@tulsiengineers.com", username: "engineer", role: "SERVICE_ENGINEER", designation: "Service Engineer", mobile: "9876500003", isEngineer: true },
    { employeeCode: "TE-004", name: "Demo Technician", email: "technician@tulsiengineers.com", username: "technician", role: "TECHNICIAN", designation: "Technician", mobile: "9876500004", isTechnician: true },
    { employeeCode: "TE-005", name: "Office Coordinator", email: "office@tulsiengineers.com", username: "office", role: "OFFICE_STAFF", designation: "Office Executive", mobile: "9876500005" },
  ];

  for (const p of people) {
    await prisma.user.upsert({
      where: { email: p.email },
      create: {
        employeeCode: p.employeeCode,
        name: p.name,
        email: p.email,
        username: p.username,
        passwordHash: pw,
        mobile: p.mobile,
        whatsapp: p.mobile,
        designation: p.designation,
        roleId: byCode[p.role],
        isEngineer: p.isEngineer ?? false,
        isTechnician: p.isTechnician ?? false,
      },
      update: { roleId: byCode[p.role], name: p.name, isEngineer: p.isEngineer ?? false, isTechnician: p.isTechnician ?? false },
    });
  }
  log(`users: ${people.length} (default password Tulsi@2026)`);
}

async function seedServiceTypes() {
  for (const [i, s] of SERVICE_TYPES.entries()) {
    await prisma.serviceType.upsert({
      where: { name: s.name },
      create: { name: s.name, category: s.category, isSystem: true, sortOrder: i },
      update: { category: s.category, sortOrder: i },
    });
  }
  log(`service types: ${SERVICE_TYPES.length}`);
}

async function seedTemplates() {
  for (const t of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, subject: t.subject, bodyHtml: t.bodyHtml, variables: t.variables, isSystem: true },
      update: { name: t.name, variables: t.variables, isSystem: true },
    });
  }
  for (const t of WHATSAPP_TEMPLATES) {
    await prisma.whatsappTemplate.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, language: t.language, bodyPreview: t.bodyPreview, variables: t.variables, isSystem: true },
      update: { bodyPreview: t.bodyPreview, variables: t.variables, isSystem: true },
    });
  }
  log(`templates: ${EMAIL_TEMPLATES.length} email, ${WHATSAPP_TEMPLATES.length} whatsapp`);
}

async function seedSettings() {
  const entries: { key: string; value: unknown; group: string; label: string }[] = [
    {
      key: "company.profile",
      group: "company",
      label: "Company Profile",
      value: {
        ...DEFAULT_COMPANY,
        addressLine1: "Plot No. 24, GIDC Industrial Estate",
        addressLine2: "Odhav Road",
        city: "Ahmedabad",
        state: "Gujarat",
        pinCode: "382415",
        phone: "079-2287XXXX",
        mobile: "+91 98250 00000",
        email: "service@tulsiengineers.com",
        website: "www.tulsiengineers.com",
        gstNumber: "24XXXXX0000X1ZX",
      },
    },
    { key: "ui.theme", group: "ui", label: "Theme Colours", value: DEFAULT_THEME },
    {
      key: "numbering.sequences",
      group: "numbering",
      label: "Document Numbering",
      value: {
        JOB: { prefix: "TE/JOB", padding: 4 },
        MOM: { prefix: "TE/MOM", padding: 4 },
        DWR: { prefix: "TE/DWR", padding: 4 },
        FSR: { prefix: "TE/FSR", padding: 4 },
        SV: { prefix: "TE/SV", padding: 4 },
        CUST: { prefix: "CUST", padding: 4 },
        SITE: { prefix: "SITE", padding: 4 },
        EQP: { prefix: "EQP", padding: 4 },
      },
    },
    {
      key: "files.limits",
      group: "files",
      label: "File Upload Limits",
      value: { maxUploadMb: 15, maxPhotosPerReport: 40, allowedImages: ["jpg", "jpeg", "png", "webp"], allowedDocs: ["pdf", "xlsx", "docx", "csv"] },
    },
    {
      key: "notifications.rules",
      group: "notifications",
      label: "Notification Rules",
      value: {
        newJob: true, jobAssigned: true, visitUpcomingDays: 2, overdueJobs: true,
        momPending: true, confirmationPending: true, dailyReportPending: true,
        reportConfirmed: true, jobCompleted: true, targetDateApproachingDays: 3,
      },
    },
    {
      key: "otp.policy",
      group: "otp",
      label: "OTP Policy",
      value: { length: 6, ttlMinutes: 10, maxAttempts: 5, maxResends: 3, preferredChannel: "WHATSAPP" },
    },
    {
      key: "pdf.options",
      group: "pdf",
      label: "PDF Options",
      value: { showLogo: true, showSignature: true, showPhotos: true, photosPerRow: 2, pageSize: "A4", showTerms: true },
    },
  ];

  for (const e of entries) {
    await prisma.systemSetting.upsert({
      where: { key: e.key },
      create: { key: e.key, value: e.value as never, group: e.group, label: e.label },
      update: {},
    });
  }
  log(`settings: ${entries.length}`);
}

// ─────────────────────────────────────────────────────────────
// DEMO WORKFLOW
// ─────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 30, 0, 0);
  return d;
}

async function seedDemo() {
  const existing = await prisma.customer.findFirst({ where: { code: "CUST-0001" } });
  if (existing) {
    log("demo data already present — skipped");
    return;
  }

  const engineer = await prisma.user.findUniqueOrThrow({ where: { email: "engineer@tulsiengineers.com" } });
  const technician = await prisma.user.findUniqueOrThrow({ where: { email: "technician@tulsiengineers.com" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@tulsiengineers.com" } });

  const customer = await prisma.customer.create({
    data: {
      code: "CUST-0001",
      companyName: "ABC Industries Pvt. Ltd.",
      contactPerson: "Rakesh Patel",
      department: "Maintenance",
      designation: "Plant Head",
      mobile: "9825011111",
      whatsapp: "9825011111",
      email: "rakesh.patel@abcindustries.example",
      gstNumber: "24AABCA1234A1Z5",
      industry: "Textile Processing",
      billingAddress: "Survey No. 112, Narol-Aslali Highway",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382405",
      remarks: "Long-standing AMC customer. Two steam boilers under contract.",
      contacts: {
        create: [
          { name: "Rakesh Patel", designation: "Plant Head", department: "Maintenance", mobile: "9825011111", whatsapp: "9825011111", email: "rakesh.patel@abcindustries.example", isPrimary: true },
          { name: "Sunil Shah", designation: "Boiler Operator", department: "Utilities", mobile: "9825022222", whatsapp: "9825022222", email: "utilities@abcindustries.example" },
        ],
      },
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      code: "CUST-0002",
      companyName: "Shreeji Chemicals Ltd.",
      contactPerson: "Mehul Desai",
      designation: "Maintenance Manager",
      mobile: "9825033333",
      whatsapp: "9825033333",
      email: "mehul.desai@shreejichem.example",
      gstNumber: "24AACCS9876B1Z2",
      industry: "Speciality Chemicals",
      billingAddress: "Plot 45, GIDC Estate, Vatva",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382445",
    },
  });

  const site = await prisma.site.create({
    data: {
      code: "SITE-0001",
      customerId: customer.id,
      name: "Ahmedabad Plant",
      address: "Survey No. 112, Narol-Aslali Highway",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382405",
      contactPerson: "Sunil Shah",
      mobile: "9825022222",
      whatsapp: "9825022222",
      email: "utilities@abcindustries.example",
      latitude: 22.9483,
      longitude: 72.6006,
      siteType: "Manufacturing Plant",
      remarks: "Boiler house is at the rear of the dyeing section. Gate pass required.",
    },
  });

  await prisma.site.create({
    data: {
      code: "SITE-0002",
      customerId: customer2.id,
      name: "Vatva Unit II",
      address: "Plot 45, GIDC Estate, Vatva",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382445",
      contactPerson: "Mehul Desai",
      mobile: "9825033333",
      siteType: "Chemical Plant",
    },
  });

  const equipment = await prisma.equipment.create({
    data: {
      code: "EQP-0001",
      customerId: customer.id,
      siteId: site.id,
      type: "STEAM_BOILER",
      name: "2 TPH Steam Boiler",
      make: "TULSI ENGINEERS",
      model: "TE-SB-2000",
      serialNumber: "TE/SB/2019/0142",
      capacity: "2000 kg/hr",
      fuelType: "Briquette / Agro Waste",
      installationDate: new Date("2019-06-14"),
      commissioningDate: new Date("2019-07-02"),
      warrantyUpto: new Date("2021-07-01"),
      amcStatus: "UNDER_AMC",
      amcValidUpto: new Date("2027-03-31"),
      specifications: {
        designPressure: "10.54 kg/cm²",
        workingPressure: "8.5 kg/cm²",
        heatingSurface: "62 m²",
        ibrRegistrationNo: "GJ/IBR/2019/1142",
        feedPump: "2 x 3 HP multistage",
        chimneyHeight: "30 m",
      },
      remarks: "IBR registered. Annual inspection due every March.",
    },
  });

  await prisma.equipment.create({
    data: {
      code: "EQP-0002",
      customerId: customer.id,
      siteId: site.id,
      type: "POLLUTION_CONTROL_EQUIPMENT",
      name: "Multi-cyclone + Wet Scrubber",
      make: "TULSI ENGINEERS",
      model: "TE-WS-15",
      serialNumber: "TE/WS/2019/0071",
      capacity: "15000 m³/hr",
      installationDate: new Date("2019-06-20"),
      amcStatus: "UNDER_AMC",
      amcValidUpto: new Date("2027-03-31"),
    },
  });

  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { name: "Preventive Maintenance" } });
  const breakdownType = await prisma.serviceType.findFirstOrThrow({ where: { name: "Boiler Breakdown Service" } });
  const fy = "2026-27";

  await prisma.numberSequence.createMany({
    data: [
      { key: "JOB", fiscalYear: fy, prefix: "TE/JOB", lastNumber: 2, padding: 4 },
      { key: "SV", fiscalYear: fy, prefix: "TE/SV", lastNumber: 1, padding: 4 },
      { key: "MOM", fiscalYear: fy, prefix: "TE/MOM", lastNumber: 1, padding: 4 },
      { key: "DWR", fiscalYear: fy, prefix: "TE/DWR", lastNumber: 2, padding: 4 },
      { key: "FSR", fiscalYear: fy, prefix: "TE/FSR", lastNumber: 1, padding: 4 },
      { key: "CUST", fiscalYear: "-", prefix: "CUST", lastNumber: 2, padding: 4 },
      { key: "SITE", fiscalYear: "-", prefix: "SITE", lastNumber: 2, padding: 4 },
      { key: "EQP", fiscalYear: "-", prefix: "EQP", lastNumber: 2, padding: 4 },
    ],
  });

  const job = await prisma.serviceJob.create({
    data: {
      jobNumber: `TE/JOB/${fy}/0001`,
      customerId: customer.id,
      siteId: site.id,
      equipmentId: equipment.id,
      serviceTypeId: serviceType.id,
      priority: "HIGH",
      requestDate: daysAgo(12),
      plannedVisitDate: daysAgo(10),
      targetCompletionDate: daysAgo(2),
      engineerId: engineer.id,
      technicianId: technician.id,
      createdById: manager.id,
      customerRequirement:
        "Annual preventive maintenance of 2 TPH steam boiler before monsoon shutdown, including water-side cleaning and safety valve testing.",
      problemDescription:
        "Steam pressure dropping intermittently. Higher than normal fuel consumption reported over the last six weeks.",
      jobDescription:
        "Complete preventive maintenance: descaling, tube cleaning, refractory inspection, mountings servicing, safety valve setting and trial run.",
      requiredMaterial: "Gasket sheet 3 mm, ceramic wool 25 mm, boiler descaling chemical 25 L",
      requiredSpare: "Safety valve spring, water level gauge glass x2, feed pump mechanical seal",
      status: "COMPLETED",
      progressPercent: 100,
      completedAt: daysAgo(2),
      remarks: "Coordinate shutdown with plant maintenance a day in advance.",
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: "NEW", changedById: manager.id, createdAt: daysAgo(12) },
          { fromStatus: "NEW", toStatus: "ASSIGNED", changedById: manager.id, createdAt: daysAgo(11) },
          { fromStatus: "ASSIGNED", toStatus: "SITE_VISIT", changedById: engineer.id, createdAt: daysAgo(10) },
          { fromStatus: "SITE_VISIT", toStatus: "MOM_CREATED", changedById: engineer.id, createdAt: daysAgo(10) },
          { fromStatus: "MOM_CREATED", toStatus: "WORK_STARTED", changedById: engineer.id, createdAt: daysAgo(6) },
          { fromStatus: "WORK_STARTED", toStatus: "WORK_IN_PROGRESS", changedById: engineer.id, createdAt: daysAgo(5) },
          { fromStatus: "WORK_IN_PROGRESS", toStatus: "COMPLETED", changedById: engineer.id, createdAt: daysAgo(2) },
        ],
      },
      assignments: {
        create: [
          { userId: engineer.id, role: "ENGINEER", assignedById: manager.id, assignedAt: daysAgo(11) },
          { userId: technician.id, role: "TECHNICIAN", assignedById: manager.id, assignedAt: daysAgo(11) },
        ],
      },
    },
  });

  const job2 = await prisma.serviceJob.create({
    data: {
      jobNumber: `TE/JOB/${fy}/0002`,
      customerId: customer2.id,
      siteId: (await prisma.site.findFirstOrThrow({ where: { code: "SITE-0002" } })).id,
      serviceTypeId: breakdownType.id,
      priority: "URGENT",
      requestDate: daysAgo(1),
      plannedVisitDate: new Date(),
      engineerId: engineer.id,
      createdById: manager.id,
      customerRequirement: "Boiler tripping on low water level. Production halted.",
      problemDescription: "Feed water pump not building pressure; low water level cut-off tripping repeatedly.",
      status: "ASSIGNED",
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: "NEW", changedById: manager.id, createdAt: daysAgo(1) },
          { fromStatus: "NEW", toStatus: "ASSIGNED", changedById: manager.id, createdAt: daysAgo(1) },
        ],
      },
      assignments: { create: [{ userId: engineer.id, role: "ENGINEER", assignedById: manager.id, assignedAt: daysAgo(1) }] },
    },
  });

  const visit = await prisma.siteVisit.create({
    data: {
      visitNumber: `TE/SV/${fy}/0001`,
      jobId: job.id,
      customerId: customer.id,
      siteId: site.id,
      visitDate: daysAgo(10),
      arrivalTime: "10:15",
      departureTime: "16:40",
      engineerId: engineer.id,
      technicianNames: "Demo Technician",
      customerRepresentative: "Sunil Shah (Boiler Operator), Rakesh Patel (Plant Head)",
      purpose: "Pre-maintenance inspection and scope finalisation",
      equipmentDetails: "2 TPH Steam Boiler, Sr. No. TE/SB/2019/0142",
      problemObserved: "Heavy scale deposition on water side. Safety valve set pressure drifted. Gauge glass leaking at bottom fitting.",
      initialObservation:
        "Boiler shell and tubes visually sound. Scale thickness approx. 2-3 mm on tube surfaces. Refractory at furnace mouth showing hairline cracks. Feed water TDS measured at 4200 ppm against recommended 3000 ppm max.",
      requiredAction:
        "Chemical descaling, mechanical tube cleaning, replace both gauge glasses, reset and test safety valves, patch furnace refractory, review blowdown schedule with plant team.",
      materialRequired: "Descaling chemical 25 L, gasket sheet 3 mm, ceramic wool 25 mm, refractory castable 50 kg",
      spareRequired: "Gauge glass x2, gauge glass washer set, safety valve spring",
      siteCondition: "Boiler house accessible. Scaffolding available. Power and water supply adequate for the work.",
      status: "SUBMITTED",
      createdById: engineer.id,
    },
  });

  const mom = await prisma.mom.create({
    data: {
      momNumber: `TE/MOM/${fy}/0001`,
      jobId: job.id,
      siteVisitId: visit.id,
      customerId: customer.id,
      siteId: site.id,
      meetingDate: daysAgo(10),
      meetingTime: "15:00",
      location: "Conference Room, ABC Industries Pvt. Ltd., Ahmedabad Plant",
      equipmentDetails: "2 TPH Steam Boiler (TE-SB-2000), Sr. No. TE/SB/2019/0142, IBR Regn. GJ/IBR/2019/1142",
      purpose: "Finalise scope, materials and shutdown schedule for annual preventive maintenance",
      discussionPoints:
        "1. Reviewed inspection findings from the morning site visit.\n2. Discussed intermittent steam pressure drop and its correlation with scale build-up.\n3. Agreed on a four-day shutdown window starting from the coming Monday.\n4. Reviewed feed water quality reports for the last three months.\n5. Discussed the commercial impact of replacing versus repairing the safety valve.",
      technicalObservations:
        "Water-side scale of 2-3 mm measured at random tube locations. Feed water TDS at 4200 ppm exceeds the recommended limit, indicating inadequate blowdown frequency. Furnace mouth refractory shows hairline cracking but no spalling. Both gauge glasses leaking at bottom fittings. Safety valve set pressure drifted to 9.4 kg/cm² against a required 9.0 kg/cm².",
      problemsIdentified:
        "a) Scale deposition reducing heat transfer and increasing fuel consumption.\nb) Inadequate blowdown practice causing high TDS.\nc) Leaking gauge glass fittings.\nd) Safety valve requires resetting and testing.\ne) Furnace refractory needs patch repair.",
      decisionsTaken:
        "1. TULSI ENGINEERS to carry out complete chemical descaling followed by mechanical tube cleaning.\n2. Both gauge glasses and washer sets to be replaced with new.\n3. Safety valves to be reset to 9.0 kg/cm² and tested in the presence of the customer's representative.\n4. Furnace mouth refractory to be patch repaired with castable.\n5. Customer to revise the blowdown schedule to twice per shift and maintain a log.\n6. Shutdown to commence on Monday 07:00 hrs; boiler to be handed over cold and drained.",
      requiredMaterials: "Descaling chemical 25 L, gasket sheet 3 mm (2 sheets), ceramic wool 25 mm (1 roll), refractory castable 50 kg",
      requiredSpares: "Gauge glass 2 nos., gauge glass washer set 2 sets, safety valve spring 1 no.",
      pendingPoints:
        "Feed water treatment plant performance to be reviewed separately — customer to share the last six months of water analysis reports.",
      recommendations:
        "Install an online TDS monitor with auto-blowdown to prevent recurrence. Consider an economiser to recover flue gas heat; a separate techno-commercial proposal can be submitted on request.",
      clientRemarks: "Customer confirmed the shutdown window and agreed to keep the boiler drained and cooled before our team arrives.",
      status: "CLIENT_CONFIRMED",
      version: 1,
      lockedAt: daysAgo(8),
      submittedAt: daysAgo(10),
      sentAt: daysAgo(9),
      confirmedAt: daysAgo(8),
      createdById: engineer.id,
      participants: {
        create: [
          { name: "Demo Service Engineer", designation: "Service Engineer", company: "TULSI ENGINEERS", party: "TULSI_ENGINEERS", mobile: "9876500003" },
          { name: "Service Manager", designation: "Service Manager", company: "TULSI ENGINEERS", party: "TULSI_ENGINEERS", mobile: "9876500002" },
          { name: "Rakesh Patel", designation: "Plant Head", company: "ABC Industries Pvt. Ltd.", party: "CUSTOMER", mobile: "9825011111" },
          { name: "Sunil Shah", designation: "Boiler Operator", company: "ABC Industries Pvt. Ltd.", party: "CUSTOMER", mobile: "9825022222" },
        ],
      },
      actionPoints: {
        create: [
          { sequence: 1, actionPoint: "Carry out chemical descaling and mechanical tube cleaning of the boiler", responsiblePerson: "Demo Service Engineer", responsibleParty: "TULSI_ENGINEERS", responsibleCompany: "TULSI ENGINEERS", dueDate: daysAgo(4), priority: "HIGH", status: "COMPLETED", completedAt: daysAgo(5) },
          { sequence: 2, actionPoint: "Replace both gauge glasses with new units and washer sets", responsiblePerson: "Demo Technician", responsibleParty: "TULSI_ENGINEERS", responsibleCompany: "TULSI ENGINEERS", dueDate: daysAgo(4), priority: "MEDIUM", status: "COMPLETED", completedAt: daysAgo(4) },
          { sequence: 3, actionPoint: "Reset and test safety valves at 9.0 kg/cm² in the presence of the customer", responsiblePerson: "Demo Service Engineer", responsibleParty: "TULSI_ENGINEERS", responsibleCompany: "TULSI ENGINEERS", dueDate: daysAgo(3), priority: "HIGH", status: "COMPLETED", completedAt: daysAgo(3) },
          { sequence: 4, actionPoint: "Patch repair furnace mouth refractory with castable", responsiblePerson: "Demo Technician", responsibleParty: "TULSI_ENGINEERS", responsibleCompany: "TULSI ENGINEERS", dueDate: daysAgo(3), priority: "MEDIUM", status: "COMPLETED", completedAt: daysAgo(3) },
          { sequence: 5, actionPoint: "Revise blowdown schedule to twice per shift and maintain a log", responsiblePerson: "Sunil Shah", responsibleParty: "CUSTOMER", responsibleCompany: "ABC Industries Pvt. Ltd.", dueDate: daysAgo(-7), priority: "HIGH", status: "IN_PROGRESS" },
          { sequence: 6, actionPoint: "Share last six months of feed water analysis reports", responsiblePerson: "Rakesh Patel", responsibleParty: "CUSTOMER", responsibleCompany: "ABC Industries Pvt. Ltd.", dueDate: daysAgo(-3), priority: "MEDIUM", status: "OPEN" },
        ],
      },
    },
  });

  await prisma.clientConfirmation.create({
    data: {
      docType: "MOM",
      recordId: mom.id,
      recordNumber: mom.momNumber,
      version: 1,
      customerId: customer.id,
      clientName: "Rakesh Patel",
      clientMobile: "9825011111",
      clientEmail: "rakesh.patel@abcindustries.example",
      status: "CONFIRMED",
      verified: true,
      verificationChannel: "WHATSAPP",
      confirmedAt: daysAgo(8),
    },
  });

  const dwr1 = await prisma.dailyWorkReport.create({
    data: {
      reportNumber: `TE/DWR/${fy}/0001`,
      jobId: job.id,
      reportDate: daysAgo(6),
      engineerId: engineer.id,
      technicianNames: "Demo Technician",
      startTime: "07:00",
      endTime: "18:30",
      workHours: 11.5,
      progressPercent: 45,
      workPerformed:
        "Boiler taken over in cold and drained condition at 07:00 hrs. Manhole and handhole doors opened. Water side inspected and photographed. Descaling chemical circulated for six hours followed by flushing. Mechanical tube cleaning started on the first pass.",
      toolsUsed: "Tube cleaning machine, circulation pump, torque wrench set, inspection camera",
      technicalFindings:
        "Scale thickness confirmed at 2.5 mm average. No pitting or thinning observed on the shell. Weld seams sound on visual inspection.",
      problems: "Bottom blowdown valve found partially choked; cleaned and re-tested during the shift.",
      pendingWork: "Second and third pass tube cleaning, gauge glass replacement, safety valve setting, refractory patch repair.",
      nextAction: "Complete mechanical cleaning of remaining passes and begin mountings servicing.",
      recommendations: "Recommend replacing the bottom blowdown valve at the next shutdown.",
      status: "CLIENT_CONFIRMED",
      lockedAt: daysAgo(5),
      submittedAt: daysAgo(6),
      sentAt: daysAgo(6),
      confirmedAt: daysAgo(5),
      createdById: engineer.id,
      materials: {
        create: [
          { name: "Boiler descaling chemical", specification: "Inhibited acid based", quantity: 25, unit: "litre" },
          { name: "Gasket sheet", specification: "3 mm CAF", quantity: 2, unit: "sheet" },
        ],
      },
      spares: { create: [{ name: "Manhole door gasket", partNumber: "TE-MH-2T", make: "TULSI ENGINEERS", quantity: 1, unit: "no." }] },
    },
  });

  const dwr2 = await prisma.dailyWorkReport.create({
    data: {
      reportNumber: `TE/DWR/${fy}/0002`,
      jobId: job.id,
      reportDate: daysAgo(3),
      engineerId: engineer.id,
      technicianNames: "Demo Technician",
      startTime: "07:30",
      endTime: "19:00",
      workHours: 11.5,
      progressPercent: 100,
      workPerformed:
        "Completed mechanical cleaning of all passes. Replaced both gauge glasses with washer sets. Serviced all mountings. Reset and tested both safety valves at 9.0 kg/cm² in the presence of the plant head. Patch repaired furnace mouth refractory and allowed curing. Boxed up the boiler, carried out hydraulic test at 1.5 times working pressure — no leakage. Light-up done at 16:00 hrs and steam raised to working pressure. Trial run of four hours completed satisfactorily.",
      toolsUsed: "Hydraulic test pump, torque wrench set, safety valve setting gag, digital pressure gauge",
      technicalFindings:
        "Post-cleaning heat transfer improved — steam raising time reduced from 95 to 62 minutes from cold. No leakage at any joint during hydraulic test.",
      problems: "None during this shift.",
      pendingWork: "Nil from TULSI ENGINEERS scope. Customer to implement the revised blowdown schedule.",
      nextAction: "Handover and final service report.",
      recommendations:
        "Maintain feed water TDS below 3000 ppm. Install an online TDS monitor with auto-blowdown. Next preventive maintenance due after 12 months or 4000 running hours, whichever is earlier.",
      status: "CLIENT_CONFIRMED",
      lockedAt: daysAgo(2),
      submittedAt: daysAgo(3),
      sentAt: daysAgo(3),
      confirmedAt: daysAgo(2),
      createdById: engineer.id,
      materials: {
        create: [
          { name: "Ceramic wool", specification: "25 mm x 610 mm", quantity: 1, unit: "roll" },
          { name: "Refractory castable", specification: "1400°C grade", quantity: 50, unit: "kg" },
        ],
      },
      spares: {
        create: [
          { name: "Gauge glass", partNumber: "GG-250-TE", make: "Standard", quantity: 2, unit: "no." },
          { name: "Gauge glass washer set", partNumber: "GGW-TE", make: "Standard", quantity: 2, unit: "set" },
          { name: "Safety valve spring", partNumber: "SV-SPR-9.0", make: "TULSI ENGINEERS", quantity: 1, unit: "no." },
        ],
      },
    },
  });

  for (const r of [dwr1, dwr2]) {
    await prisma.clientConfirmation.create({
      data: {
        docType: "DAILY_WORK_REPORT",
        recordId: r.id,
        recordNumber: r.reportNumber,
        version: 1,
        customerId: customer.id,
        clientName: "Rakesh Patel",
        clientMobile: "9825011111",
        status: "CONFIRMED",
        verified: true,
        verificationChannel: "WHATSAPP",
        confirmedAt: r.confirmedAt,
      },
    });
  }

  const fsr = await prisma.finalServiceReport.create({
    data: {
      reportNumber: `TE/FSR/${fy}/0001`,
      jobId: job.id,
      customerId: customer.id,
      siteId: site.id,
      workStartDate: daysAgo(6),
      workEndDate: daysAgo(3),
      engineerName: "Demo Service Engineer",
      technicianNames: "Demo Technician",
      workPerformed:
        "Annual preventive maintenance of the 2 TPH steam boiler completed as per MOM TE/MOM/2026-27/0001. Scope covered chemical descaling, mechanical cleaning of all passes, replacement of both gauge glasses and washer sets, servicing of all mountings, resetting and testing of both safety valves at 9.0 kg/cm², patch repair of furnace mouth refractory, hydraulic testing at 1.5 times working pressure and a four-hour trial run.",
      materialsSummary: "Descaling chemical 25 L; gasket sheet 3 mm 2 sheets; ceramic wool 25 mm 1 roll; refractory castable 50 kg",
      sparesSummary: "Gauge glass 2 nos.; gauge glass washer set 2 sets; safety valve spring 1 no.; manhole door gasket 1 no.",
      testingDetails:
        "Hydraulic test at 12.75 kg/cm² held for 30 minutes — no leakage or pressure drop. Safety valve 1 popped at 9.0 kg/cm², reseated at 8.6 kg/cm². Safety valve 2 popped at 9.05 kg/cm², reseated at 8.65 kg/cm². Low water level cut-off and high pressure cut-out function tested and found satisfactory. Trial run of four hours at working pressure completed without abnormality.",
      observations:
        "Steam raising time from cold reduced from 95 minutes to 62 minutes after cleaning, confirming restored heat transfer. Fuel consumption during the trial run measured 12% lower than the pre-service baseline.",
      pendingWork: "Nil in TULSI ENGINEERS scope. Customer-side action points from the MOM remain open and are tracked separately.",
      recommendations:
        "1. Maintain feed water TDS below 3000 ppm with blowdown twice per shift and maintain a log.\n2. Install an online TDS monitor with auto-blowdown.\n3. Replace the bottom blowdown valve at the next shutdown.\n4. Next preventive maintenance due after 12 months or 4000 running hours, whichever is earlier.",
      finalRemarks:
        "Boiler handed over in running condition on " +
        daysAgo(3).toLocaleDateString("en-IN") +
        " at 19:00 hrs to Mr. Sunil Shah. All work completed within the agreed shutdown window.",
      completionDate: daysAgo(2),
      status: "CLIENT_CONFIRMED",
      version: 1,
      lockedAt: daysAgo(2),
      submittedAt: daysAgo(3),
      sentAt: daysAgo(3),
      confirmedAt: daysAgo(2),
      createdById: engineer.id,
    },
  });

  await prisma.clientConfirmation.create({
    data: {
      docType: "FINAL_SERVICE_REPORT",
      recordId: fsr.id,
      recordNumber: fsr.reportNumber,
      version: 1,
      customerId: customer.id,
      clientName: "Rakesh Patel",
      clientMobile: "9825011111",
      clientEmail: "rakesh.patel@abcindustries.example",
      status: "CONFIRMED",
      verified: true,
      verificationChannel: "WHATSAPP",
      confirmedAt: daysAgo(2),
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: engineer.id, type: "JOB_ASSIGNED", title: "New job assigned", message: `Job ${job2.jobNumber} — Shreeji Chemicals Ltd. (URGENT breakdown)`, link: `/jobs/${job2.id}`, recordId: job2.id },
      { userId: manager.id, type: "REPORT_CONFIRMED", title: "Final report confirmed", message: `${fsr.reportNumber} confirmed by Rakesh Patel`, link: `/final-reports/${fsr.id}`, recordId: fsr.id },
      { userId: manager.id, type: "ACTION_POINT_DUE", title: "Customer action point pending", message: "ABC Industries: feed water analysis reports not yet received", link: `/mom/${mom.id}`, recordId: mom.id },
    ],
  });

  log("demo data: 2 customers, 2 sites, 2 equipment, 2 jobs, 1 visit, 1 MOM (6 action points), 2 daily reports, 1 final report, 4 confirmations");
}

async function main() {
  const demoOnly = process.argv.includes("--demo-only");
  console.log("\nSeeding TULSI ENGINEERS database\n");
  if (!demoOnly) {
    await seedPermissions();
    await seedRoles();
    await seedUsers();
    await seedServiceTypes();
    await seedTemplates();
    await seedSettings();
  }
  if (!process.argv.includes("--no-demo")) await seedDemo();
  console.log("\nSeed complete.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
