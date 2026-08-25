"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS } from "./nav";
import { canAny } from "@/lib/rbac";

export function Sidebar({
  permissions,
  companyName,
  logoUrl,
  open,
  onClose,
}: {
  permissions: string[];
  companyName: string;
  logoUrl?: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((i) => canAny(permissions, i.permission));

  const body = (
    <div className="flex h-full flex-col bg-[var(--te-sidebar)] text-slate-200">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
        <Image src={logoUrl || "/logo.jpeg"} alt="" width={32} height={32} className="h-8 w-8 rounded bg-white object-contain p-0.5" unoptimized />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight font-bold tracking-wide text-white">{companyName}</p>
          <p className="text-[10px] tracking-wider text-slate-400 uppercase">Service Management</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="te-focus rounded p-1 text-slate-300 hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = visible.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-4">
              <p className="px-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{group}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={clsx(
                          "te-focus flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-[var(--te-accent)] text-white shadow-sm"
                            : "text-slate-300 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          {companyName}
          <br />
          Service &amp; Site Work Management
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block no-print">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden />
          <div className="animate-in absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{body}</div>
        </div>
      )}
    </>
  );
}
