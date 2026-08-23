"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastApi {
  push: (tone: ToastTone, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE: Record<ToastTone, { icon: typeof Info; ring: string; bg: string; fg: string }> = {
  success: { icon: CheckCircle2, ring: "border-green-200", bg: "bg-green-50", fg: "text-green-800" },
  error: { icon: XCircle, ring: "border-red-200", bg: "bg-red-50", fg: "text-red-800" },
  warning: { icon: AlertTriangle, ring: "border-amber-200", bg: "bg-amber-50", fg: "text-amber-900" },
  info: { icon: Info, ring: "border-blue-200", bg: "bg-blue-50", fg: "text-blue-800" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-3), { id, tone, title, message }]);
      setTimeout(() => remove(id), tone === "error" ? 7000 : 4500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, m) => push("success", t, m),
      error: (t, m) => push("error", t, m),
      warning: (t, m) => push("warning", t, m),
      info: (t, m) => push("info", t, m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end no-print">
        {items.map((t) => {
          const cfg = TONE[t.tone];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border ${cfg.ring} ${cfg.bg} p-3 shadow-lg shadow-slate-900/5`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.fg}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${cfg.fg}`}>{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t.message}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => remove(t.id)}
                className="te-focus rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
