import "server-only";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";

/**
 * Photographs are embedded into generated documents as data URIs rather than
 * as links back to /api/files. Chromium renders the PDF without a session
 * cookie, and the client portal serves the same markup to an unauthenticated
 * visitor, so a linked image would silently come back 401 and the report would
 * print with blank frames.
 *
 * Images are downscaled to keep the resulting PDF small enough to email — a
 * site photograph straight off a phone is often 4 MB, and a report with a dozen
 * of them would be unusable as an attachment.
 */

const MAX_WIDTH = 1400;
const JPEG_QUALITY = 72;

const cache = new Map<string, string>();
const CACHE_LIMIT = 200;

export async function photoDataUri(photoId: string): Promise<string | null> {
  const hit = cache.get(photoId);
  if (hit) return hit;

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, deletedAt: null },
    select: { storageKey: true, mimeType: true },
  });
  if (!photo) return null;

  let buffer: Buffer;
  try {
    buffer = await getFile(photo.storageKey);
  } catch {
    return null;
  }

  let mimeType = photo.mimeType;
  try {
    const sharp = (await import("sharp")).default;
    const resized = await sharp(buffer)
      .rotate() // honour the EXIF orientation phones write
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    buffer = resized;
    mimeType = "image/jpeg";
  } catch (err) {
    // Downscaling is an optimisation, not a requirement — fall back to the
    // original bytes so the document still prints correctly.
    console.warn("[pdf] image downscale unavailable, embedding the original", err);
  }

  const uri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(photoId, uri);
  return uri;
}

export function clearPhotoCache() {
  cache.clear();
}
