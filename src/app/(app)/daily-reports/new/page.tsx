"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DailyReportForm } from "../DailyReportForm";

export default function NewDailyReportPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? undefined;

  return (
    <>
      <PageHeader
        title="New Daily Work Report"
        description="Record the work carried out on a service job today."
        crumbs={[{ label: "Daily Work Reports", href: "/daily-reports" }, { label: "New" }]}
      />
      <DailyReportForm initialJobId={jobId} />
    </>
  );
}
