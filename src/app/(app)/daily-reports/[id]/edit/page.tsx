"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, Button, LoadingBlock } from "@/components/ui/primitives";
import { DailyReportForm, type DailyReportRecord } from "../../DailyReportForm";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function EditDailyReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [report, setReport] = useState<DailyReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviseBusy, setReviseBusy] = useState(false);

  useEffect(() => {
    api
      .get<DailyReportRecord>(`/api/daily-reports/${id}`)
      .then(setReport)
      .catch((err) => toast.error("Could not load this report", err instanceof ApiError ? err.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const revise = async () => {
    setReviseBusy(true);
    try {
      await api.post(`/api/documents/DAILY_WORK_REPORT/${id}/revise`);
      toast.success("New version started — you can now edit this report");
      const fresh = await api.get<DailyReportRecord>(`/api/daily-reports/${id}`);
      setReport(fresh);
    } catch (err) {
      toast.error("Could not revise this report", err instanceof ApiError ? err.message : undefined);
    } finally {
      setReviseBusy(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading report…" />;
  if (!report) return null;

  return (
    <>
      <PageHeader
        title={`Edit ${report.reportNumber}`}
        crumbs={[
          { label: "Daily Work Reports", href: "/daily-reports" },
          { label: report.reportNumber, href: `/daily-reports/${report.id}` },
          { label: "Edit" },
        ]}
      />

      {report.status === "CLIENT_CONFIRMED" ? (
        <Alert tone="warning" title="This report is locked">
          The client has confirmed {report.reportNumber} and it can no longer be edited directly. Start a new version
          to make changes — this clears the confirmation and withdraws the link that was sent to the client.
          <div className="mt-3">
            <Button onClick={revise} loading={reviseBusy}>
              Revise — create version {report.version + 1}
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={() => router.push(`/daily-reports/${report.id}`)}>
              Back to report
            </Button>
          </div>
          <DailyReportForm reportId={report.id} initial={report} />
        </>
      )}
    </>
  );
}
