"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { MomForm } from "../MomForm";

export default function NewMomPage() {
  return (
    <>
      <PageHeader
        title="New Minutes of Meeting"
        description="Record what was discussed, decided and agreed during a site meeting, with trackable action points."
        crumbs={[{ label: "MOM", href: "/mom" }, { label: "New" }]}
      />
      <MomForm />
    </>
  );
}
