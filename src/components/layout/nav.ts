import {
  LayoutDashboard, Building2, MapPin, Cog, ClipboardList, CarFront, FileText,
  CalendarDays, FileCheck2, Images, HardHat, BadgeCheck, Mail, MessageSquare,
  BarChart3, Bell, ScrollText, Users, ShieldCheck, Wrench, FileCode2,
  Settings, DatabaseBackup,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Any one of these permissions grants visibility. */
  permission: string[];
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: ["dashboard.view"], group: "Overview" },

  { label: "Customers", href: "/customers", icon: Building2, permission: ["customers.view"], group: "Masters" },
  { label: "Sites", href: "/sites", icon: MapPin, permission: ["sites.view"], group: "Masters" },
  { label: "Equipment", href: "/equipment", icon: Cog, permission: ["equipment.view"], group: "Masters" },

  { label: "Service Jobs", href: "/jobs", icon: ClipboardList, permission: ["jobs.view"], group: "Operations" },
  { label: "Site Visits", href: "/visits", icon: CarFront, permission: ["visits.view"], group: "Operations" },
  { label: "MOM", href: "/mom", icon: FileText, permission: ["mom.view"], group: "Operations" },
  { label: "Daily Work Reports", href: "/daily-reports", icon: CalendarDays, permission: ["daily_reports.view"], group: "Operations" },
  { label: "Final Service Reports", href: "/final-reports", icon: FileCheck2, permission: ["final_reports.view"], group: "Operations" },
  { label: "Photos & Documents", href: "/photos", icon: Images, permission: ["photos.view"], group: "Operations" },

  { label: "Engineers & Technicians", href: "/staff", icon: HardHat, permission: ["staff.view"], group: "People & Clients" },
  { label: "Client Confirmations", href: "/confirmations", icon: BadgeCheck, permission: ["confirmations.view"], group: "People & Clients" },
  { label: "Email History", href: "/email-history", icon: Mail, permission: ["email.view"], group: "People & Clients" },
  { label: "WhatsApp History", href: "/whatsapp-history", icon: MessageSquare, permission: ["whatsapp.view"], group: "People & Clients" },

  { label: "Reports & Analytics", href: "/analytics", icon: BarChart3, permission: ["analytics.view"], group: "Insights" },
  { label: "Notifications", href: "/notifications", icon: Bell, permission: ["notifications.view"], group: "Insights" },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, permission: ["audit.view"], group: "Insights" },

  { label: "Users", href: "/users", icon: Users, permission: ["users.view"], group: "Administration" },
  { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck, permission: ["roles.view"], group: "Administration" },
  { label: "Service Master", href: "/service-master", icon: Wrench, permission: ["masters.view"], group: "Administration" },
  { label: "Templates", href: "/templates", icon: FileCode2, permission: ["templates.view"], group: "Administration" },
  { label: "System Settings", href: "/settings", icon: Settings, permission: ["settings.view"], group: "Administration" },
  { label: "Backup & Data", href: "/backup", icon: DatabaseBackup, permission: ["backup.view"], group: "Administration" },
];

export const NAV_GROUPS = ["Overview", "Masters", "Operations", "People & Clients", "Insights", "Administration"];
