"use client";

import { useEffect, useState } from "react";
import { Download, Database, HardDrive, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Alert, LoadingBlock, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client-api";
import { formatBytes, formatDateTime, formatNumber, titleCase } from "@/lib/format";

interface BackupStats {
  rowCounts: Record<string, number>;
  storage: { fileCount: number; totalBytes: number };
  oldestRecordAt: string | null;
  newestRecordAt: string | null;
}

export default function BackupPage() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<BackupStats>("/api/backup/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Backup & Data"
        description="What is stored, how much of it there is, and how to keep a copy safe."
        crumbs={[{ label: "Backup & Data" }]}
        actions={
          <a
            href="/api/backup"
            className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--te-primary)] px-4 text-sm font-medium text-white shadow-sm hover:bg-[var(--te-primary-dark)]"
          >
            <Download className="h-4 w-4" /> Download JSON backup
          </a>
        }
      />

      {loading ? (
        <LoadingBlock label="Reading database statistics…" />
      ) : !stats ? (
        <Alert tone="danger">Backup statistics could not be read. Check that the database is reachable.</Alert>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Database}
              label="Business records"
              value={formatNumber(Object.values(stats.rowCounts).reduce((a, b) => a + b, 0))}
              sub="across all master and transaction tables"
            />
            <StatCard
              icon={HardDrive}
              label="Stored files"
              value={formatNumber(stats.storage.fileCount)}
              sub={`${formatBytes(stats.storage.totalBytes)} of photos, documents and PDFs`}
            />
            <StatCard
              icon={Clock}
              label="Data range"
              value={stats.oldestRecordAt ? formatDateTime(stats.oldestRecordAt).split(",")[0] : "—"}
              sub={stats.newestRecordAt ? `latest ${formatDateTime(stats.newestRecordAt)}` : "no records yet"}
            />
          </div>

          <Card title="Record counts">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(stats.rowCounts).map(([key, count]) => (
                <div key={key} className="border-b border-slate-100 pb-1.5">
                  <dt className="text-[11px] tracking-wide text-slate-500 uppercase">{titleCase(key.replace(/([A-Z])/g, "_$1"))}</dt>
                  <dd className="text-lg font-bold text-slate-800">{formatNumber(count)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Recommended production backup strategy">
            <div className="space-y-4 text-sm leading-relaxed text-slate-600">
              <div>
                <SectionTitle>1. Database — the primary protection</SectionTitle>
                <p>
                  Use a managed PostgreSQL service with point-in-time recovery, such as Neon or Supabase. Both keep a
                  continuous write-ahead log, so the database can be restored to any moment within the retention window
                  rather than only to the last nightly snapshot. Confirm the retention period on your plan and, for a
                  service business, keep at least 7 days.
                </p>
              </div>

              <div>
                <SectionTitle>2. Files — versioned object storage</SectionTitle>
                <p>
                  Photographs, uploaded documents and generated PDFs live in object storage, not in the database. Enable
                  bucket versioning and a lifecycle rule on your S3-compatible bucket so a deleted or overwritten file
                  can be recovered. If storage is still set to LOCAL, move it to S3 before going live — local files are
                  lost whenever the application is redeployed on most cloud hosts.
                </p>
              </div>

              <div>
                <SectionTitle>3. Portable snapshot — this JSON export</SectionTitle>
                <p>
                  The download button above produces a single JSON file containing every business record: customers,
                  sites, equipment, jobs, visits, MOMs, action points, daily reports, final reports, confirmations,
                  file metadata, settings and templates. It deliberately excludes password hashes, sessions, reset
                  tokens and one-time passwords. Keep a copy off-site — for example in Google Drive — monthly and before
                  any major change.
                </p>
              </div>

              <div>
                <SectionTitle>How to restore</SectionTitle>
                <ol className="ml-4 list-decimal space-y-1">
                  <li>Restore the database from the managed provider&apos;s point-in-time recovery to a new instance.</li>
                  <li>Point <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> at the restored instance and run <code className="rounded bg-slate-100 px-1">npm run db:deploy</code> to confirm the schema matches.</li>
                  <li>Restore the storage bucket, or roll back individual objects using versioning.</li>
                  <li>Sign in as a Super Admin and spot-check a recent job, its photos and its PDF.</li>
                </ol>
                <p className="mt-2">
                  The JSON export is a safety net for reading and re-importing data, not a one-click restore — the
                  database snapshot is always the faster and more complete route.
                </p>
              </div>
            </div>
          </Card>

          <Alert tone="warning" title="Test your backups">
            A backup that has never been restored is only a hope. Restore into a staging environment at least once a
            quarter and confirm you can open a job, its photographs and a generated PDF.
          </Alert>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--te-primary-light)]">
          <Icon className="h-4 w-4 text-[var(--te-primary)]" />
        </span>
        <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
