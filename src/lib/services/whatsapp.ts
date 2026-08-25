import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { renderTemplate } from "@/lib/services/templates";
import type { DocumentType } from "@/generated/prisma";

export interface SendWhatsappInput {
  templateCode: string;
  to: string;
  variables?: Record<string, string | number | undefined>;
  /** Ordered body parameters. Falls back to the template's declared variable order. */
  bodyParams?: string[];
  docType?: DocumentType;
  recordId?: string;
  recordNumber?: string;
  customerId?: string;
  sentById?: string;
}

/**
 * Normalises an Indian mobile number to WhatsApp's E.164-without-plus format.
 * "98765 43210" → "919876543210". Numbers already carrying a country code pass through.
 */
export function normaliseWhatsappNumber(raw: string, defaultCountryCode = "91"): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

export function whatsappConfigured(): boolean {
  if (env.whatsapp.driver !== "CLOUD_API") return false;
  if (env.whatsapp.provider === "WAPIO") {
    return Boolean(env.whatsapp.wapio.apiKey && env.whatsapp.wapio.instanceName);
  }
  return Boolean(env.whatsapp.phoneNumberId && env.whatsapp.accessToken);
}

/**
 * Sends a WhatsApp Business Cloud API template message.
 * Credentials live only in environment variables and are never returned to the
 * client. Every attempt is written to `whatsapp_logs`.
 */
export async function sendWhatsappTemplate(input: SendWhatsappInput) {
  const tpl = await prisma.whatsappTemplate.findUnique({ where: { code: input.templateCode } });
  const to = normaliseWhatsappNumber(input.to);

  const declared = (tpl?.variables as string[] | null) ?? [];
  const params =
    input.bodyParams ??
    declared.map((key) => {
      const v = input.variables?.[key];
      return v === undefined || v === null ? "" : String(v);
    });

  const preview = tpl?.bodyPreview
    ? tpl.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? "")
    : renderTemplate(tpl?.name ?? input.templateCode, input.variables ?? {});

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: tpl?.name ?? input.templateCode.toLowerCase(),
      language: { code: tpl?.language ?? env.whatsapp.defaultLanguage },
      components: params.length
        ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
        : [],
    },
  };

  const log = await prisma.whatsappLog.create({
    data: {
      templateCode: input.templateCode,
      templateName: tpl?.name ?? null,
      toNumber: to,
      payload: payload as never,
      bodyPreview: preview.slice(0, 500),
      docType: input.docType ?? null,
      recordId: input.recordId ?? null,
      recordNumber: input.recordNumber ?? null,
      customerId: input.customerId ?? null,
      sentById: input.sentById ?? null,
      status: "QUEUED",
    },
  });

  if (!to) {
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: "No valid WhatsApp number on record." },
    });
    return { id: log.id, delivered: false, error: "No valid WhatsApp number is saved for this contact." };
  }

  if (!whatsappConfigured()) {
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage:
          "WHATSAPP_DRIVER=LOG — message recorded but not transmitted. Set WHATSAPP_DRIVER=CLOUD_API with valid credentials to send for real.",
      },
    });
    console.info(`[whatsapp:LOG] to=${to} template=${payload.template.name}`);
    return { id: log.id, delivered: false, simulated: true };
  }

  try {
    const request =
      env.whatsapp.provider === "WAPIO"
        ? {
            url: env.whatsapp.wapio.endpoint,
            headers: {
              Authorization: `Bearer ${env.whatsapp.wapio.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              instanceName: env.whatsapp.wapio.instanceName,
              number: to,
              type: "text",
              message: preview,
            }),
          }
        : {
            url: `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`,
            headers: {
              Authorization: `Bearer ${env.whatsapp.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          };

    const res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });
    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; error_data?: { details?: string } };
    };

    if (!res.ok) {
      const message = json?.error?.error_data?.details || json?.error?.message || `HTTP ${res.status}`;
      await prisma.whatsappLog.update({
        where: { id: log.id },
        data: { status: "FAILED", errorMessage: String(message).slice(0, 500) },
      });
      console.error("[whatsapp] send failed", message);
      return { id: log.id, delivered: false, error: "The WhatsApp message could not be sent. Please check the WhatsApp settings." };
    }

    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: json.messages?.[0]?.id ?? null },
    });
    return { id: log.id, delivered: true };
  } catch (err) {
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: (err instanceof Error ? err.message : "Network error").slice(0, 500) },
    });
    console.error("[whatsapp] send error", err);
    return { id: log.id, delivered: false, error: "The WhatsApp message could not be sent." };
  }
}
