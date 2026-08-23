import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { sendTemplatedEmail } from "@/lib/services/email";
import { getCompany } from "@/lib/settings";

const schema = z.object({ to: z.string().trim().email("Enter a valid email address") });

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("settings.manage");
    const { to } = schema.parse(await req.json());
    const company = await getCompany();

    const result = await sendTemplatedEmail({
      templateCode: "SETTINGS_TEST_EMAIL",
      to,
      sentById: actor.id,
      override: {
        subject: `Test email from ${company.name}`,
        bodyHtml: `<p>This is a test message sent from the ${company.name} system settings page to confirm your email configuration is working correctly.</p>`,
      },
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
