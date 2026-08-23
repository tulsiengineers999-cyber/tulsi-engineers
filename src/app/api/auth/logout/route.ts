import { ok, fail } from "@/lib/http";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    await destroySession();
    if (user) await audit({ userId: user.id, userName: user.name, action: "LOGOUT", module: "auth" });
    return ok({ signedOut: true });
  } catch (e) {
    return fail(e);
  }
}
