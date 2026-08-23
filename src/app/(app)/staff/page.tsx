import Link from "next/link";
import { Phone, MessageSquare, Mail, HardHat } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, EmptyState, LinkButton } from "@/components/ui/primitives";
import { initials } from "@/lib/format";
import { normaliseWhatsappNumber } from "@/lib/services/whatsapp";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requirePermission("staff.view");
  const { role } = await searchParams;

  const roleFilter =
    role === "engineer" ? { isEngineer: true } : role === "technician" ? { isTechnician: true } : { OR: [{ isEngineer: true }, { isTechnician: true }] };

  const staff = await prisma.user.findMany({
    where: { deletedAt: null, status: "ACTIVE", ...roleFilter },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, employeeCode: true, designation: true, mobile: true,
      whatsapp: true, email: true, isEngineer: true, isTechnician: true,
    },
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const ids = staff.map((s) => s.id);

  const [openJobs, completedThisMonth, todaysVisits] = await Promise.all([
    ids.length
      ? prisma.serviceJob.groupBy({
          by: ["engineerId"],
          where: { deletedAt: null, engineerId: { in: ids }, status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.serviceJob.groupBy({
          by: ["engineerId"],
          where: { deletedAt: null, engineerId: { in: ids }, status: { in: ["COMPLETED", "CLOSED"] }, completedAt: { gte: startOfMonth } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.siteVisit.groupBy({
          by: ["engineerId"],
          where: { deletedAt: null, engineerId: { in: ids }, visitDate: { gte: startOfToday, lt: endOfToday } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const openMap = new Map(openJobs.map((r) => [r.engineerId, r._count._all]));
  const doneMap = new Map(completedThisMonth.map((r) => [r.engineerId, r._count._all]));
  const visitMap = new Map(todaysVisits.map((r) => [r.engineerId, r._count._all]));

  const tabs = [
    { key: "", label: "Everyone" },
    { key: "engineer", label: "Engineers" },
    { key: "technician", label: "Technicians" },
  ];

  return (
    <>
      <PageHeader
        title="Engineers & Technicians"
        description="Who is in the field, what they are carrying, and how to reach them."
        crumbs={[{ label: "Engineers & Technicians" }]}
        actions={
          <LinkButton href="/users" variant="outline">
            Manage user accounts
          </LinkButton>
        }
      />

      <nav className="mb-4 flex gap-2 no-print">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/staff?role=${t.key}` : "/staff"}
            className={`te-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              (role ?? "") === t.key
                ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={HardHat}
            title="No field staff yet"
            description="Mark a user as an engineer or technician under Users to see them here."
            action={<LinkButton href="/users">Go to Users</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => {
            const wa = s.whatsapp ? normaliseWhatsappNumber(s.whatsapp) : "";
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--te-primary)] text-sm font-bold text-white">
                    {initials(s.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/users/${s.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-[var(--te-primary)] hover:underline">
                      {s.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {[s.designation, s.employeeCode].filter(Boolean).join(" · ") || "Field staff"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.isEngineer && <Badge tone="info">Engineer</Badge>}
                      {s.isTechnician && <Badge tone="info">Technician</Badge>}
                    </div>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Open" value={openMap.get(s.id) ?? 0} tone="text-[var(--te-primary)]" />
                  <Stat label="Today" value={visitMap.get(s.id) ?? 0} tone="text-[var(--te-accent)]" />
                  <Stat label="Done" value={doneMap.get(s.id) ?? 0} tone="text-green-700" />
                </div>

                <div className="flex gap-2">
                  {s.mobile && (
                    <a
                      href={`tel:${s.mobile}`}
                      className="te-focus inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="te-focus inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="te-focus inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-1.5">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</p>
    </div>
  );
}
