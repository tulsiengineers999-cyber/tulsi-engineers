"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { PhotoUploader, PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";

export function PhotoPanel({
  siteVisitId,
  jobId,
  photos,
  canUpload,
  canDelete,
}: {
  siteVisitId: string;
  jobId: string;
  photos: GalleryPhoto[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();

  return (
    <Card title="Site photographs" description="Captured during the visit and included in the PDF.">
      <div className="space-y-5">
        {canUpload && (
          <PhotoUploader
            link={{ siteVisitId, jobId }}
            defaultCategory="EQUIPMENT"
            onUploaded={() => router.refresh()}
          />
        )}
        <PhotoGallery photos={photos} canDelete={canDelete} onDeleted={() => router.refresh()} />
      </div>
    </Card>
  );
}
