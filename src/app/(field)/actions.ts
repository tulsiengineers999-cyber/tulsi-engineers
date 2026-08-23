"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}