import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY, DEFAULT_THEME, type CompanyProfile } from "@/lib/company";

export { DEFAULT_COMPANY, DEFAULT_THEME };
export type { CompanyProfile };

const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 15_000;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const row = await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null);
  const value = (row?.value ?? fallback) as T;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting(
  key: string,
  value: unknown,
  meta?: { group?: string; label?: string; isSecret?: boolean; updatedById?: string },
) {
  const row = await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      group: meta?.group ?? key.split(".")[0] ?? "general",
      label: meta?.label,
      isSecret: meta?.isSecret ?? false,
      updatedById: meta?.updatedById,
    },
    update: { value: value as never, updatedById: meta?.updatedById },
  });
  cache.delete(key);
  return row;
}

export function clearSettingsCache() {
  cache.clear();
}

export async function getCompany(): Promise<CompanyProfile> {
  const stored = await getSetting<Partial<CompanyProfile>>("company.profile", {});
  return { ...DEFAULT_COMPANY, ...stored };
}

export async function getTheme() {
  const stored = await getSetting<Partial<typeof DEFAULT_THEME>>("ui.theme", {});
  return { ...DEFAULT_THEME, ...stored };
}
