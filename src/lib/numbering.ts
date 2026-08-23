import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export type SequenceKey = "JOB" | "MOM" | "DWR" | "FSR" | "SV" | "CUST" | "SITE" | "EQP";

const DEFAULT_PREFIX: Record<SequenceKey, string> = {
  JOB: "TE/JOB",
  MOM: "TE/MOM",
  DWR: "TE/DWR",
  FSR: "TE/FSR",
  SV: "TE/SV",
  CUST: "CUST",
  SITE: "SITE",
  EQP: "EQP",
};

/** Keys that carry the Indian fiscal year (1 April – 31 March) in the number. */
const FISCAL_KEYS: SequenceKey[] = ["JOB", "MOM", "DWR", "FSR", "SV"];

export function fiscalYear(date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1; // month 3 = April
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * Atomically allocates the next number for a sequence.
 * Uses an interactive transaction with an upsert so concurrent requests
 * can never receive the same number.
 */
export async function nextNumber(key: SequenceKey, at = new Date()): Promise<string> {
  const useFiscal = FISCAL_KEYS.includes(key);
  const fy = useFiscal ? fiscalYear(at) : "-";
  const configured = await getSetting<Record<string, { prefix?: string; padding?: number }>>(
    "numbering.sequences",
    {},
  );
  const prefix = configured?.[key]?.prefix ?? DEFAULT_PREFIX[key];
  const padding = configured?.[key]?.padding ?? 4;

  const seq = await prisma.$transaction(async (tx) => {
    const existing = await tx.numberSequence.findUnique({
      where: { key_fiscalYear: { key, fiscalYear: fy } },
    });
    if (!existing) {
      return tx.numberSequence.create({
        data: { key, fiscalYear: fy, prefix, padding, lastNumber: 1 },
      });
    }
    return tx.numberSequence.update({
      where: { key_fiscalYear: { key, fiscalYear: fy } },
      data: { lastNumber: { increment: 1 }, prefix, padding },
    });
  });

  const serial = String(seq.lastNumber).padStart(seq.padding, "0");
  return useFiscal ? `${seq.prefix}/${fy}/${serial}` : `${seq.prefix}-${serial}`;
}
