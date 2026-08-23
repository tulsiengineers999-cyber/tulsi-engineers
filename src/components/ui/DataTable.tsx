"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { EmptyState, Spinner } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  /** Rendered inside the cell. */
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hidden below the sm breakpoint — keeps mobile tables readable. */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyTitle = "No records found",
  emptyDescription,
  emptyAction,
  rowHref,
  meta,
  onPageChange,
  compact,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  rowHref?: (row: T) => string;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Spinner /> Loading records…
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx(
                    "px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase whitespace-nowrap",
                    align(c.align),
                    c.hideOnMobile && "hidden sm:table-cell",
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                {columns.map((c, i) => {
                  const content = c.cell(row);
                  const href = rowHref?.(row);
                  return (
                    <td
                      key={c.key}
                      className={clsx(
                        compact ? "px-3 py-2" : "px-3 py-3",
                        align(c.align),
                        c.hideOnMobile && "hidden sm:table-cell",
                        c.className,
                      )}
                    >
                      {href && i === 0 ? (
                        <Link href={href} className="te-focus block font-medium text-[var(--te-primary)] hover:underline">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.pageCount > 1 && onPageChange && (
        <Pagination meta={meta} onPageChange={onPageChange} />
      )}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (p: number) => void }) {
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-1 pt-3 no-print">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}</span>–
        <span className="font-semibold text-slate-700">{to}</span> of{" "}
        <span className="font-semibold text-slate-700">{meta.total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          className="te-focus inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 disabled:opacity-40 enabled:hover:bg-slate-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <span className="px-2 text-xs text-slate-500">
          Page {meta.page} of {meta.pageCount}
        </span>
        <button
          type="button"
          disabled={meta.page >= meta.pageCount}
          onClick={() => onPageChange(meta.page + 1)}
          className="te-focus inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 disabled:opacity-40 enabled:hover:bg-slate-50"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
