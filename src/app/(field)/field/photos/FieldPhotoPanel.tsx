"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button, Card, Field, Select, EmptyState } from "@/components/ui/primitives";
import { PhotoUploader, PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { PHOTO_CATEGORY_LABELS } from "@/lib/masters";

export interface FieldPhotoJob {
  id: string;
  jobNumber: string;
  customerName: string;
}

export function FieldPhotoPanel({
  jobs,
  photos,
  canUpload,
}: {
  jobs: FieldPhotoJob[];
  photos: GalleryPhoto[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [filter, setFilter] = useState("");

  const visible = filter ? photos.filter((p) => p.category === filter) : photos;
  const categories = [...new Set(photos.map((p) => p.category))];

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card bodyClassName="p-4">
          {!uploading ? (
            <Button size="lg" className="w-full" onClick={() => setUploading(true)} disabled={!jobs.length}>
              <Camera className="h-4 w-4" /> Upload photos
            </Button>
          ) : (
            <div className="space-y-3.5">
              <Field label="Attach to job" required>
                <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="h-12 text-base">
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobNumber} — {j.customerName}
                    </option>
                  ))}
                </Select>
              </Field>
              {jobId && (
                <PhotoUploader
                  link={{ jobId }}
                  compact
                  onUploaded={() => {
                    setUploading(false);
                    router.refresh();
                  }}
                />
              )}
              <Button variant="ghost" className="w-full" onClick={() => setUploading(false)}>
                Cancel
              </Button>
            </div>
          )}
          {!jobs.length && (
            <p className="mt-2 text-center text-xs text-slate-500">
              You have no assigned jobs to attach photographs to.
            </p>
          )}
        </Card>
      )}

      {photos.length === 0 ? (
        <Card>
          <EmptyState
            icon={Camera}
            title="No photographs yet"
            description="Photographs you upload from site appear here and in the job's reports."
          />
        </Card>
      ) : (
        <Card bodyClassName="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("")}
              className={`te-focus rounded-full border px-3 py-1 text-xs font-medium ${
                filter === "" ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]" : "border-slate-300 text-slate-600"
              }`}
            >
              All ({photos.length})
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`te-focus rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === c ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]" : "border-slate-300 text-slate-600"
                }`}
              >
                {PHOTO_CATEGORY_LABELS[c] ?? c}
              </button>
            ))}
          </div>
          <PhotoGallery photos={visible} onDeleted={() => router.refresh()} />
        </Card>
      )}
    </div>
  );
}
