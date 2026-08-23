import { getCompany, DEFAULT_COMPANY } from "@/lib/settings";

// Company branding is read from the database at request time, so these pages
// must never be prerendered at build time (the database is not reachable then).
export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const company = await getCompany().catch(() => DEFAULT_COMPANY);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — hidden on phones so the form gets the full screen */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--te-sidebar)] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px, 64px 64px",
          }}
        />
        <div className="relative">
          <div className="mb-2 inline-grid h-12 w-12 place-items-center rounded-lg bg-[var(--te-accent)] text-lg font-black">
            TE
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">{company.name}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">{company.tagline}</p>
        </div>

        <div className="relative">
          <p className="mb-4 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            One system, end to end
          </p>
          <ul className="space-y-2.5 text-sm text-slate-300">
            {[
              "Service request to final client confirmation",
              "Site visits, MOM and trackable action points",
              "Daily work reports with before / during / after photos",
              "Branded PDFs delivered by email and WhatsApp",
              "OTP-verified client confirmation on every report",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--te-accent)]" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-500">
          {[company.addressLine1, company.city, company.state].filter(Boolean).join(", ")}
          {company.phone ? ` · ${company.phone}` : ""}
        </p>
      </div>

      <div className="flex items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 inline-grid h-11 w-11 place-items-center rounded-lg bg-[var(--te-accent)] text-base font-black text-white">
              TE
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">{company.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{company.tagline}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
