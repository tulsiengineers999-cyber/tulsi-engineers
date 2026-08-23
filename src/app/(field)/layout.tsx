import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, CarFront, CalendarDays, Images, LayoutDashboard, LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/settings";
import { can } from "@/lib/rbac";
import { initials } from "@/lib/format";
import { signOutAction } from "./actions";

const TABS = [
  { href: "/field", label: "My Jobs", icon: ClipboardList },
  { href: "/field/visits", label: "Visits", icon: CarFront },
  { href: "/field/daily", label: "Daily Work", icon: CalendarDays },
  { href: "/field/photos", label: "Photos", icon: Images },
];

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = await getCompany();
  const canSeeDashboard = can(user.permissions, "dashboard.view");

  return (
    <div className="flex h-dvh flex-col bg-[var(--te-bg)]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--te-accent)] text-xs font-black text-white">
          TE
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{company.name}</p>
        {canSeeDashboard && (
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="te-focus grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <LayoutDashboard className="h-5 w-5" />
          </Link>
        )}
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--te-primary)] text-xs font-bold text-white"
          title={user.name}
        >
          {initials(user.name)}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="te-focus grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-3 py-4 pb-24">{children}</div>
      </main>

      <nav
        aria-label="Field navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(15,23,42,0.06)]"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="te-focus flex flex-col items-center justify-center gap-0.5 py-2.5 text-slate-500 hover:text-[var(--te-primary)]"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
