"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { api, qs } from "@/lib/client-api";

interface SearchHit {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  subtitle?: string;
  href: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get<SearchHit[]>(`/api/search${qs({ q })}`);
        if (!cancelled) {
          setHits(res ?? []);
          setCursor(0);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    router.push(hit.href);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && hits[cursor]) {
              go(hits[cursor]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search customers, jobs, MOM, reports, serial numbers…"
          className="te-focus h-9 w-full rounded-md border border-slate-300 bg-slate-50 pr-12 pl-9 text-sm placeholder:text-slate-400 focus:bg-white"
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
          Ctrl K
        </kbd>
        {busy && <Loader2 className="absolute top-1/2 right-12 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="animate-in absolute z-50 mt-1.5 max-h-96 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {hits.length === 0 && !busy && (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              No matches for “{q}”. Try a job number, serial number, mobile or company name.
            </p>
          )}
          {hits.map((h, i) => (
            <button
              key={`${h.type}-${h.id}`}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(h)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === cursor ? "bg-slate-50" : ""}`}
            >
              <span className="shrink-0 rounded bg-[var(--te-primary-light)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--te-primary)] uppercase">
                {h.typeLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{h.title}</span>
                {h.subtitle && <span className="block truncate text-xs text-slate-500">{h.subtitle}</span>}
              </span>
              {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
