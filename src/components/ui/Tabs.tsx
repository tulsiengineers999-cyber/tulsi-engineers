"use client";

import clsx from "clsx";

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("-mx-4 mb-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0 no-print", className)}>
      <nav className="flex gap-1" role="tablist">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={clsx(
                "te-focus flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                on
                  ? "border-[var(--te-accent)] text-[var(--te-primary)]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px] font-bold", on ? "bg-[var(--te-primary-light)] text-[var(--te-primary)]" : "bg-slate-100 text-slate-500")}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
