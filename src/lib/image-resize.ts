"use client";

/**
 * Shrinks a photograph in the browser before it is uploaded.
 *
 * Two reasons this matters more than it looks:
 *
 *  1. Serverless hosts cap the request body. Vercel's limit is 4.5 MB, and a
 *     modern phone camera produces 4–8 MB per shot — a single untouched
 *     photograph would be rejected outright.
 *  2. Engineers upload from a boiler house on mobile data. Sending 350 KB
 *     instead of 5 MB is the difference between a report filed on site and one
 *     filed that evening from the office.
 *
 * The long edge is capped at 1600 px, which is still well beyond what an A4
 * PDF or a phone screen can show. EXIF orientation is handled by the browser's
 * own decoder via `createImageBitmap`.
 */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;

/** Below this there is nothing worth compressing. */
const SKIP_BELOW_BYTES = 400 * 1024;

export interface ResizedImage {
  file: File;
  originalBytes: number;
  resizedBytes: number;
}

export async function downscaleImage(file: File): Promise<ResizedImage> {
  const original = file.size;

  // HEIC and anything the canvas cannot decode is passed through untouched;
  // the server rejects it with a clear message if it is genuinely too large.
  if (file.size <= SKIP_BELOW_BYTES || !canDecode(file.type)) {
    return { file, originalBytes: original, resizedBytes: original };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      return { file, originalBytes: original, resizedBytes: original };
    }

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    const resized = new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
    return { file: resized, originalBytes: original, resizedBytes: resized.size };
  } catch {
    // Never block an upload because resizing failed.
    return { file, originalBytes: original, resizedBytes: original };
  }
}

function canDecode(mime: string): boolean {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}
