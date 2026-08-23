import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [company, unreadCount] = await Promise.all([
    getCompany(),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <AppShell user={user} companyName={company.name} logoUrl={company.logoUrl || undefined} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
