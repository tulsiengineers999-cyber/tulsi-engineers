"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, Button, LoadingBlock } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";
import { MomForm, type MomFormInitial } from "../../MomForm";

interface MomRecord extends MomFormInitial {
  id: string;
  momNumber: string;
  status: string;
}

export default function EditMomPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [mom, setMom] = useState<MomRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<MomRecord>(`/api/mom/${params.id}`);
      setMom(data);
    } catch (err) {
      toast.error("Could not load this MOM", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const revise = async () => {
    setBusy(true);
    try {
      await api.post(`/api/mom/${params.id}/revise`);
      toast.success("New version created — you can now edit it.");
      await load();
    } catch (err) {
      toast.error("Could not revise this MOM", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading MOM…" />;
  }
  if (!mom) return null;

  return (
    <>
      <PageHeader
        title={`Edit ${mom.momNumber}`}
        crumbs={[{ label: "MOM", href: "/mom" }, { label: mom.momNumber, href: `/mom/${mom.id}` }, { label: "Edit" }]}
      />

      {mom.status === "CLIENT_CONFIRMED" ? (
        <Alert tone="warning" title="This MOM has been confirmed by the client">
          <p className="mb-3">
            It is locked and cannot be edited directly. Create a new version to make changes — the client will need to
            confirm it again.
          </p>
          <Button onClick={revise} loading={busy}>Revise this MOM</Button>
        </Alert>
      ) : (
        <MomForm initial={mom} momId={mom.id} />
      )}
    </>
  );
}
