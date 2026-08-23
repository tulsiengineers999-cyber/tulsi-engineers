"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="te-focus h-9 w-full rounded-md border border-slate-300 bg-white pr-8 pl-9 text-sm placeholder:text-slate-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="te-focus absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        "te-focus h-9 rounded-md border px-2.5 text-sm",
        value ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] font-medium text-[var(--te-primary)]" : "border-slate-300 bg-white text-slate-600",
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FilterBar({
  children,
  onReset,
  activeCount = 0,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 no-print">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[12rem]">{Array.isArray(children) ? children[0] : children}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "te-focus inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium sm:hidden",
            activeCount ? "border-[var(--te-primary)] text-[var(--te-primary)]" : "border-slate-300 text-slate-600",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {Array.isArray(children) ? children.slice(1) : null}
          {onReset && activeCount > 0 && (
            <button type="button" onClick={onReset} className="te-focus text-xs font-medium text-slate-500 hover:text-[var(--te-primary)]">
              Reset
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="animate-in mt-2 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:hidden">
          {Array.isArray(children) ? children.slice(1) : null}
          {onReset && activeCount > 0 && (
            <button type="button" onClick={onReset} className="te-focus text-xs font-medium text-slate-500">
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
