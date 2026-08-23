"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { SessionUser } from "@/lib/auth/session";

export function AppShell({
  user,
  companyName,
  logoUrl,
  unreadCount,
  children,
}: {
  user: SessionUser;
  companyName: string;
  logoUrl?: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--te-bg)]">
      <Sidebar
        permissions={user.permissions}
        companyName={companyName}
        logoUrl={logoUrl}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} unreadCount={unreadCount} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
