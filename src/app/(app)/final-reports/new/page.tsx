"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FileEdit } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Field, Select, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { FinalReportForm } from "../FinalReportForm";

interface JobOption {
  id: string;
  jobNumber: string;
  customer: { companyName: string };
  site: { name: string };
}

export default function NewFinalReportPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"generate" | "manual">("generate");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.list<JobOption>(`/api/jobs${qs({ pageSize: 100 })}`).then((r) => setJobs(r.items)).catch(() => undefined);
  }, []);

  const generate = async () => {
    if (!jobId) {
      setError("Select a job first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await api.post<{ id: string }>("/api/final-reports/generate", { jobId });
      toast.success("Draft final service report generated — review it before sending");
      router.push(`/final-reports/${report.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New Final Service Report"
        description="Summarise the completed job for the customer's records and sign-off."
        crumbs={[{ label: "Final Service Reports", href: "/final-reports" }, { label: "New" }]}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant={mode === "generate" ? "primary" : "outline"} onClick={() => setMode("generate")}>
          <Sparkles className="h-4 w-4" /> Generate from job
        </Button>
        <Button variant={mode === "manual" ? "primary" : "outline"} onClick={() => setMode("manual")}>
          <FileEdit className="h-4 w-4" /> Start blank
        </Button>
      </div>

      {mode === "generate" ? (
        <Card
          title="Generate from a job"
          description="Pulls in the daily work reports, materials and spares already recorded against the job as a starting draft — review and edit before sending."
        >
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Job" required>
              <Select value={jobId} onChange={(e) => setJobId(e.target.value)} autoFocus>
                <option value="">Select job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.jobNumber} — {j.customer.companyName} · {j.site.name}</option>
                ))}
              </Select>
            </Field>
            <Button onClick={generate} loading={busy}>Generate draft</Button>
          </div>
        </Card>
      ) : (
        <FinalReportForm />
      )}
    </>
  );
}
