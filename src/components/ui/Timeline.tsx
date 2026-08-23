import clsx from "clsx";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export interface TimelineEntry {
  id: string;
  title: string;
  description?: string | null;
  at: string | Date;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  href?: string;
  meta?: string;
}

const DOT = {
  primary: "bg-[var(--te-primary)]",
  success: "bg-green-600",
  warning: "bg-amber-500",
  danger: "bg-red-600",
  neutral: "bg-slate-400",
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) {
    return <p className="py-6 text-center text-sm text-slate-500">Nothing recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-0">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white", DOT[e.tone ?? "neutral"])} />
            {i < entries.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {e.href ? (
                <Link href={e.href} className="text-sm font-semibold text-[var(--te-primary)] hover:underline">
                  {e.title}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-slate-800">{e.title}</p>
              )}
              <time className="text-[11px] whitespace-nowrap text-slate-400">{formatDateTime(e.at)}</time>
            </div>
            {e.description && <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-line text-slate-600">{e.description}</p>}
            {e.meta && <p className="mt-0.5 text-[11px] text-slate-400">{e.meta}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
