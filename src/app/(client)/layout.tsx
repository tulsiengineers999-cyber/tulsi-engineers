import { getCompany } from "@/lib/settings";
import { formatCompanyAddress } from "@/lib/company";

/**
 * Standalone shell for the public, token-authenticated client report portal.
 * No sidebar, no admin navigation, no user menu — and, deliberately, no call
 * to getCurrentUser(). This surface must render for a visitor with no
 * session and no account at all.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const company = await getCompany();
  const address = formatCompanyAddress(company);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--te-bg)]">
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded object-contain" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--te-primary)] text-sm font-bold text-white">
              TE
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-bold tracking-tight text-[var(--te-primary)] sm:text-lg">
              {company.name}
            </p>
            <p className="truncate text-[11px] leading-tight text-slate-500">{company.tagline}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs leading-relaxed text-slate-500 no-print">
        <p className="text-sm font-semibold text-slate-700">{company.name}</p>
        {address && <p className="mt-0.5">{address}</p>}
        <p className="mt-0.5">
          {[company.phone, company.mobile].filter(Boolean).join(" · ")}
          {company.email ? ` · ${company.email}` : ""}
        </p>
      </footer>
    </div>
  );
}
