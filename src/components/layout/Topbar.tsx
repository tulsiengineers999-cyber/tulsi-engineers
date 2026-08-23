"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Bell, ChevronDown, LogOut, KeyRound, Smartphone } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { api } from "@/lib/client-api";
import { initials } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/session";

export function Topbar({
  user,
  onMenu,
  unreadCount,
}: {
  user: SessionUser;
  onMenu: () => void;
  unreadCount: number;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5 no-print">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="te-focus -ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="flex-1 sm:hidden" />

      {(user.isEngineer || user.isTechnician) && (
        <Link
          href="/field"
          className="te-focus hidden items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:inline-flex"
        >
          <Smartphone className="h-3.5 w-3.5" /> Field view
        </Link>
      )}

      <Link
        href="/notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="te-focus relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--te-accent)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="te-focus flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-slate-100"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--te-primary)] text-xs font-bold text-white">
            {initials(user.name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-[13px] leading-tight font-semibold text-slate-800">
              {user.name}
            </span>
            <span className="block text-[11px] leading-tight text-slate-500">{user.roleName}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {menuOpen && (
          <div className="animate-in absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <p className="mt-1 inline-block rounded bg-[var(--te-primary-light)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--te-primary)] uppercase">
                {user.roleName}
              </p>
            </div>
            <Link
              href="/account/password"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4 text-slate-400" /> Change password
            </Link>
            {(user.isEngineer || user.isTechnician) && (
              <Link
                href="/field"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:hidden"
              >
                <Smartphone className="h-4 w-4 text-slate-400" /> Field view
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
