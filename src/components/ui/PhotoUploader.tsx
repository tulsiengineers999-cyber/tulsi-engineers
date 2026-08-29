"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2, Loader2, X } from "lucide-react";
import { Button, Select, Textarea, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";
import { PHOTO_CATEGORY_LABELS } from "@/lib/masters";
import { formatBytes } from "@/lib/format";
import { downscaleImage } from "@/lib/image-resize";

export interface PhotoLink {
  jobId?: string;
  siteVisitId?: string;
  momId?: string;
  dailyReportId?: string;
  finalReportId?: string;
  equipmentId?: string;
}

interface Pending {
  id: string;
  file: File;
  preview: string;
}

const MAX_MB = 15;

export function PhotoUploader({
  link,
  onUploaded,
  defaultCategory = "DURING_WORK",
  compact,
}: {
  link: PhotoLink;
  onUploaded?: () => void;
  defaultCategory?: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        toast.warning("Skipped a file", `${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.warning("File too large", `${file.name} is ${formatBytes(file.size)}. Maximum is ${MAX_MB} MB.`);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) });
    }
    setPending((p) => [...p, ...next].slice(0, 40));
  };

  const removePending = (id: string) => {
    setPending((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return p.filter((x) => x.id !== id);
    });
  };

  /**
   * Photographs are shrunk in the browser and sent one per request. Serverless
   * hosts cap the request body — Vercel's limit is 4.5 MB — so a single batched
   * upload of untouched phone photographs would be rejected. Sending them
   * individually also means a dropped connection loses one photograph, not all
   * forty, and the engineer can see progress on a slow site connection.
   */
  const upload = async () => {
    if (!pending.length) return;
    setBusy(true);
    setProgress({ done: 0, total: pending.length });

    const uploaded: string[] = [];
    const failed: { name: string; reason: string }[] = [];
    let savedBytes = 0;

    for (const [index, item] of pending.entries()) {
      try {
        const { file, originalBytes, resizedBytes } = await downscaleImage(item.file);
        savedBytes += originalBytes - resizedBytes;

        const form = new FormData();
        form.append("files", file);
        form.append("category", category);
        form.append("description", description);
        for (const [k, v] of Object.entries(link)) if (v) form.append(k, v);

        await api.post("/api/photos", form);
        uploaded.push(item.id);
      } catch (err) {
        failed.push({
          name: item.file.name,
          reason: err instanceof ApiError ? err.message : "Upload failed",
        });
      }
      setProgress({ done: index + 1, total: pending.length });
    }

    // Keep whatever failed on screen so it can be retried without re-selecting.
    setPending((p) => {
      p.filter((x) => uploaded.includes(x.id)).forEach((x) => URL.revokeObjectURL(x.preview));
      return p.filter((x) => !uploaded.includes(x.id));
    });

    if (uploaded.length) {
      toast.success(
        `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`,
        savedBytes > 0 ? `${formatBytes(savedBytes)} of mobile data saved by resizing.` : undefined,
      );
      setDescription("");
      onUploaded?.();
      router.refresh();
    }
    if (failed.length) {
      toast.error(
        `${failed.length} photo${failed.length === 1 ? "" : "s"} could not be uploaded`,
        `${failed[0].reason} Tap upload again to retry the ones still shown.`,
      );
    }

    setProgress(null);
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size={compact ? "md" : "lg"} onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" /> Camera
        </Button>
        <Button type="button" variant="outline" size={compact ? "md" : "lg"} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Gallery
        </Button>
      </div>

      {pending.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {pending.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  aria-label="Remove"
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(PHOTO_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Description (applies to all)</Label>
              <Textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Water side after descaling…" />
            </div>
          </div>

          <Button type="button" onClick={upload} loading={busy} className="w-full" size="lg">
            {progress
              ? `Uploading ${progress.done} of ${progress.total}…`
              : `Upload ${pending.length} photo${pending.length === 1 ? "" : "s"}`}
          </Button>

          {progress && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
              <div
                className="h-full bg-[var(--te-accent)] transition-[width] duration-200"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface GalleryPhoto {
  id: string;
  category: string;
  fileName: string;
  description: string | null;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { name: string } | null;
}

export function PhotoGallery({
  photos,
  onDeleted,
  canDelete,
  clientToken,
}: {
  photos: GalleryPhoto[];
  onDeleted?: () => void;
  canDelete?: boolean;
  clientToken?: string;
}) {
  const toast = useToast();
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const src = (id: string) =>
    clientToken ? `/api/files/${id}?type=photo&t=${encodeURIComponent(clientToken)}` : `/api/files/${id}?type=photo`;

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await api.del(`/api/photos/${id}`);
      toast.success("Photo deleted");
      onDeleted?.();
    } catch (err) {
      toast.error("Could not delete photo", err instanceof ApiError ? err.message : undefined);
    } finally {
      setDeleting(null);
    }
  };

  if (!photos.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No photos uploaded yet.</p>;
  }

  const grouped = photos.reduce<Record<string, GalleryPhoto[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-5">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <p className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              {PHOTO_CATEGORY_LABELS[cat] ?? cat} ({list.length})
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <button type="button" onClick={() => setLightbox(p)} className="block aspect-4/3 w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src(p.id)} alt={p.description ?? p.fileName} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </button>
                  {p.description && (
                    <figcaption className="truncate border-t border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                      {p.description}
                    </figcaption>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      disabled={deleting === p.id}
                      aria-label="Delete photo"
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      {deleting === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4 no-print" onClick={() => setLightbox(null)}>
          <div className="flex items-start justify-between gap-4 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{PHOTO_CATEGORY_LABELS[lightbox.category] ?? lightbox.category}</p>
              <p className="truncate text-xs text-white/70">{lightbox.description || lightbox.fileName}</p>
            </div>
            <button type="button" aria-label="Close" className="rounded p-1.5 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(lightbox.id)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <a
            href={`${src(lightbox.id)}&download=1`}
            download
            onClick={(e) => e.stopPropagation()}
            className="mx-auto mt-3 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Download original
          </a>
        </div>
      )}
    </>
  );
}
