/**
 * Role-Based Access Control.
 * Permission codes are `<module>.<action>`. Roles are stored in the DB and
 * are fully editable from Admin → Roles & Permissions; this file only supplies
 * the catalogue of known permissions and the factory defaults used at seed time.
 */

export const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "sites", label: "Sites" },
  { key: "equipment", label: "Equipment" },
  { key: "jobs", label: "Service Jobs" },
  { key: "visits", label: "Site Visits" },
  { key: "mom", label: "MOM" },
  { key: "daily_reports", label: "Daily Work Reports" },
  { key: "final_reports", label: "Final Service Reports" },
  { key: "photos", label: "Photos & Documents" },
  { key: "staff", label: "Engineers & Technicians" },
  { key: "confirmations", label: "Client Confirmations" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "analytics", label: "Reports & Analytics" },
  { key: "notifications", label: "Notifications" },
  { key: "audit", label: "Audit Logs" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "masters", label: "Service Master" },
  { key: "templates", label: "PDF / Email / WhatsApp Templates" },
  { key: "settings", label: "System Settings" },
  { key: "backup", label: "Backup & Data" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const ACTIONS = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "assign", label: "Assign" },
  { key: "pdf", label: "Generate PDF" },
  { key: "download", label: "Download" },
  { key: "print", label: "Print" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "confirm", label: "Confirm" },
  { key: "manage", label: "Manage" },
  { key: "export", label: "Export" },
] as const;

export type ActionKey = (typeof ACTIONS)[number]["key"];

/** Which actions are meaningful for which module. */
export const MODULE_ACTIONS: Record<ModuleKey, ActionKey[]> = {
  dashboard: ["view"],
  customers: ["view", "create", "edit", "delete", "export"],
  sites: ["view", "create", "edit", "delete", "export"],
  equipment: ["view", "create", "edit", "delete", "export"],
  jobs: ["view", "create", "edit", "delete", "assign", "approve", "export"],
  visits: ["view", "create", "edit", "delete", "pdf", "download", "print"],
  mom: ["view", "create", "edit", "delete", "approve", "pdf", "download", "print", "email", "whatsapp", "confirm"],
  daily_reports: ["view", "create", "edit", "delete", "approve", "pdf", "download", "print", "email", "whatsapp", "confirm"],
  final_reports: ["view", "create", "edit", "delete", "approve", "pdf", "download", "print", "email", "whatsapp", "confirm"],
  photos: ["view", "create", "delete", "download"],
  staff: ["view", "create", "edit", "delete"],
  confirmations: ["view", "confirm", "export"],
  email: ["view", "email"],
  whatsapp: ["view", "whatsapp"],
  analytics: ["view", "export"],
  notifications: ["view", "manage"],
  audit: ["view", "export"],
  users: ["view", "create", "edit", "delete", "manage"],
  roles: ["view", "create", "edit", "delete", "manage"],
  masters: ["view", "create", "edit", "delete"],
  templates: ["view", "create", "edit", "delete"],
  settings: ["view", "edit", "manage"],
  backup: ["view", "manage"],
};

export function allPermissionCodes(): { code: string; module: ModuleKey; action: ActionKey; label: string }[] {
  const out: { code: string; module: ModuleKey; action: ActionKey; label: string }[] = [];
  for (const m of MODULES) {
    for (const a of MODULE_ACTIONS[m.key]) {
      const actionLabel = ACTIONS.find((x) => x.key === a)?.label ?? a;
      out.push({ code: `${m.key}.${a}`, module: m.key, action: a, label: `${actionLabel} ${m.label}` });
    }
  }
  return out;
}

export const ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SERVICE_MANAGER: "SERVICE_MANAGER",
  SERVICE_ENGINEER: "SERVICE_ENGINEER",
  TECHNICIAN: "TECHNICIAN",
  OFFICE_STAFF: "OFFICE_STAFF",
  ACCOUNTS_STAFF: "ACCOUNTS_STAFF",
  READ_ONLY: "READ_ONLY",
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

export const DEFAULT_ROLES: {
  code: RoleCode;
  name: string;
  rank: number;
  description: string;
  /** "*" = every permission; otherwise explicit codes or `module.*` wildcards. */
  permissions: string[];
}[] = [
  {
    code: ROLE.SUPER_ADMIN,
    name: "Super Admin",
    rank: 1,
    description: "Unrestricted access including users, roles, settings and backup.",
    permissions: ["*"],
  },
  {
    code: ROLE.ADMIN,
    name: "Admin",
    rank: 10,
    description: "Full operational access; cannot manage Super Admin accounts.",
    permissions: [
      "dashboard.*", "customers.*", "sites.*", "equipment.*", "jobs.*", "visits.*",
      "mom.*", "daily_reports.*", "final_reports.*", "photos.*", "staff.*",
      "confirmations.*", "email.*", "whatsapp.*", "analytics.*", "notifications.*",
      "audit.view", "audit.export", "users.*", "masters.*", "templates.*", "settings.view", "settings.edit",
    ],
  },
  {
    code: ROLE.SERVICE_MANAGER,
    name: "Service Manager",
    rank: 20,
    description: "Runs day-to-day service operations, assigns engineers and approves reports.",
    permissions: [
      "dashboard.view", "customers.view", "customers.create", "customers.edit",
      "sites.view", "sites.create", "sites.edit", "equipment.view", "equipment.create", "equipment.edit",
      "jobs.*", "visits.*", "mom.*", "daily_reports.*", "final_reports.*", "photos.*",
      "staff.view", "confirmations.view", "confirmations.export",
      "email.view", "email.email", "whatsapp.view", "whatsapp.whatsapp",
      "analytics.view", "analytics.export", "notifications.view", "masters.view",
    ],
  },
  {
    code: ROLE.SERVICE_ENGINEER,
    name: "Service Engineer",
    rank: 30,
    description: "Field engineer: own jobs, site visits, MOM drafts, daily work and photos.",
    permissions: [
      "dashboard.view", "customers.view", "sites.view", "equipment.view",
      "jobs.view", "jobs.edit",
      "visits.view", "visits.create", "visits.edit", "visits.pdf", "visits.download",
      "mom.view", "mom.create", "mom.edit", "mom.pdf", "mom.download",
      "daily_reports.view", "daily_reports.create", "daily_reports.edit", "daily_reports.pdf", "daily_reports.download",
      "final_reports.view", "final_reports.create", "final_reports.edit",
      "photos.view", "photos.create", "photos.delete", "photos.download",
      "notifications.view",
    ],
  },
  {
    code: ROLE.TECHNICIAN,
    name: "Technician",
    rank: 40,
    description: "Records daily work and uploads photos for assigned jobs.",
    permissions: [
      "dashboard.view", "customers.view", "sites.view", "equipment.view", "jobs.view",
      "visits.view", "visits.create", "visits.edit",
      "mom.view",
      "daily_reports.view", "daily_reports.create", "daily_reports.edit",
      "photos.view", "photos.create", "photos.download",
      "notifications.view",
    ],
  },
  {
    code: ROLE.OFFICE_STAFF,
    name: "Office Staff",
    rank: 50,
    description: "Back-office data entry and client communication.",
    permissions: [
      "dashboard.view", "customers.*", "sites.*", "equipment.view", "equipment.create", "equipment.edit",
      "jobs.view", "jobs.create", "jobs.edit",
      "visits.view", "mom.view", "mom.pdf", "mom.download", "mom.print", "mom.email", "mom.whatsapp",
      "daily_reports.view", "daily_reports.pdf", "daily_reports.download", "daily_reports.email", "daily_reports.whatsapp",
      "final_reports.view", "final_reports.pdf", "final_reports.download", "final_reports.email", "final_reports.whatsapp",
      "photos.view", "photos.download", "confirmations.view",
      "email.view", "email.email", "whatsapp.view", "whatsapp.whatsapp",
      "analytics.view", "notifications.view",
    ],
  },
  {
    code: ROLE.ACCOUNTS_STAFF,
    name: "Accounts Staff",
    rank: 60,
    description: "Read access to service records plus analytics and exports.",
    permissions: [
      "dashboard.view", "customers.view", "sites.view", "equipment.view", "jobs.view",
      "visits.view", "mom.view", "mom.download", "daily_reports.view", "daily_reports.download",
      "final_reports.view", "final_reports.download", "photos.view",
      "confirmations.view", "confirmations.export", "analytics.view", "analytics.export",
    ],
  },
  {
    code: ROLE.READ_ONLY,
    name: "Read Only User",
    rank: 90,
    description: "View-only access to operational records.",
    permissions: [
      "dashboard.view", "customers.view", "sites.view", "equipment.view", "jobs.view",
      "visits.view", "mom.view", "daily_reports.view", "final_reports.view",
      "photos.view", "confirmations.view", "analytics.view",
    ],
  },
];

/** Expands "*" and "module.*" patterns into concrete permission codes. */
export function expandPermissions(patterns: string[]): string[] {
  const all = allPermissionCodes().map((p) => p.code);
  if (patterns.includes("*")) return all;
  const out = new Set<string>();
  for (const p of patterns) {
    if (p.endsWith(".*")) {
      const mod = p.slice(0, -2);
      all.filter((c) => c.startsWith(`${mod}.`)).forEach((c) => out.add(c));
    } else if (all.includes(p)) {
      out.add(p);
    }
  }
  return [...out];
}

/** True when the permission set satisfies the requested code. */
export function can(permissions: Set<string> | string[], code: string): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has("*")) return true;
  return set.has(code);
}

export function canAny(permissions: Set<string> | string[], codes: string[]): boolean {
  return codes.some((c) => can(permissions, c));
}
