"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { PhotoUploader, PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";

export function PhotoPanel({
  dailyReportId,
  jobId,
  photos,
}: {
  dailyReportId: string;
  jobId: string;
  photos: GalleryPhoto[];
}) {
  const router = useRouter();

  return (
    <Card title="Photographs">
      <div className="space-y-5">
        <PhotoUploader link={{ dailyReportId, jobId }} onUploaded={() => router.refresh()} />
        <PhotoGallery photos={photos} canDelete onDeleted={() => router.refresh()} />
      </div>
    </Card>
  );
}
