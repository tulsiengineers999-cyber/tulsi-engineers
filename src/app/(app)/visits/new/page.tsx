"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingBlock } from "@/components/ui/primitives";
import { VisitForm } from "../VisitForm";

function NewVisit() {
  const jobId = useSearchParams().get("jobId") ?? undefined;

  return (
    <>
      <PageHeader
        title="New Site Visit"
        description="Record what was seen on site. This becomes the basis for the MOM and the work that follows."
        crumbs={[{ label: "Site Visits", href: "/visits" }, { label: "New" }]}
      />
      <VisitForm lockedJobId={jobId} />
    </>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewVisit />
    </Suspense>
  );
}
