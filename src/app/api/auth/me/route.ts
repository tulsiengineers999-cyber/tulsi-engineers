import { ok, fail } from "@/lib/http";
import { requireUser } from "@/lib/guard";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(user);
  } catch (e) {
    return fail(e);
  }
}
