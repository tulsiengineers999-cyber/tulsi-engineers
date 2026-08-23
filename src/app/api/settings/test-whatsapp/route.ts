import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { sendWhatsappTemplate } from "@/lib/services/whatsapp";
import { env } from "@/lib/env";

const schema = z.object({ to: z.string().trim().min(6, "Enter a valid mobile number") });

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("settings.manage");
    const { to } = schema.parse(await req.json());

    const result = await sendWhatsappTemplate({
      templateCode: "OTP",
      to,
      bodyParams: ["123456", String(env.otp.ttlMinutes)],
      sentById: actor.id,
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
