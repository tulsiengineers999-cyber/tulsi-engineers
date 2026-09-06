import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { sendWhatsappTemplate } from "@/lib/services/whatsapp";
import { whatsappNumberError } from "@/lib/validation/whatsapp";

const schema = z.object({
  to: z.string().trim().min(1, "Enter a WhatsApp mobile number.").superRefine((value, ctx) => {
    const message = whatsappNumberError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("settings.manage");
    const { to } = schema.parse(await req.json());

    const result = await sendWhatsappTemplate({
      templateCode: "hello_world",
      to,
      sentById: actor.id,
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
