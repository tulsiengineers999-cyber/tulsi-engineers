import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.isEngineer || user.isTechnician ? "/field" : "/dashboard");

  const sp = await searchParams;
  return <LoginForm next={sp.next} justReset={sp.reset === "1"} />;
}
