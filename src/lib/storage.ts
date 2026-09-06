import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
  "text/csv",
  "text/plain",
];

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/csv": "csv",
  "text/plain": "txt",
};

export interface StoredFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function localRoot() {
  return path.resolve(process.cwd(), env.storage.localPath);
}

/** Guards against path traversal in a storage key. */
function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\0")) {
    throw new AppError("Invalid file reference.", 400, "BAD_REQUEST");
  }
}

export function validateUpload(file: { type: string; size: number }, kind: "image" | "document" | "any") {
  const allowed =
    kind === "image"
      ? ALLOWED_IMAGE_TYPES
      : kind === "document"
        ? ALLOWED_DOC_TYPES
        : [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

  if (!allowed.includes(file.type)) {
    throw new AppError(
      `This file type is not supported. Allowed: ${allowed.map((t) => EXT_BY_MIME[t] ?? t).join(", ")}.`,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }
  const maxBytes = env.storage.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new AppError(`File is too large. Maximum allowed size is ${env.storage.maxUploadMb} MB.`, 413, "FILE_TOO_LARGE");
  }
}

/**
 * Persists a buffer and returns its storage key.
 * LOCAL driver writes under LOCAL_STORAGE_PATH (outside /public so files are
 * only reachable through the authorised /api/files route).
 * S3 driver signs a PUT against any S3-compatible endpoint. DATABASE stores
 * the bytes in PostgreSQL and is useful for deployments without object storage.
 */
export async function putFile(
  folder: string,
  originalName: string,
  mimeType: string,
  data: Buffer,
): Promise<StoredFile> {
  const ext = EXT_BY_MIME[mimeType] ?? path.extname(originalName).replace(".", "") ?? "bin";
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;

  if (env.storage.driver === "S3") {
    await s3Put(key, mimeType, data);
  } else if (env.storage.driver === "DATABASE") {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    await prisma.storageBlob.upsert({
      where: { storageKey: key },
      create: { storageKey: key, mimeType, data: bytes },
      update: { mimeType, data: bytes },
    });
  } else {
    const dest = path.join(localRoot(), key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
  }

  return { storageKey: key, fileName: safeName(originalName), mimeType, sizeBytes: data.length };
}

export async function getFile(key: string): Promise<Buffer> {
  assertSafeKey(key);
  if (env.storage.driver === "S3") return s3Get(key);
  if (env.storage.driver === "DATABASE") {
    const blob = await prisma.storageBlob.findUnique({ where: { storageKey: key }, select: { data: true } });
    if (!blob) throw new AppError("The stored file could not be found.", 404, "FILE_NOT_FOUND");
    return Buffer.from(blob.data);
  }
  return fs.readFile(path.join(localRoot(), key));
}

export async function deleteFile(key: string): Promise<void> {
  assertSafeKey(key);
  try {
    if (env.storage.driver === "S3") {
      await s3Delete(key);
    } else if (env.storage.driver === "DATABASE") {
      await prisma.storageBlob.delete({ where: { storageKey: key } });
    } else {
      await fs.unlink(path.join(localRoot(), key));
    }
  } catch {
    /* already gone */
  }
}

// ── Minimal S3 (SigV4) client — works with AWS S3, Supabase Storage,
//    Cloudflare R2, Backblaze B2 and MinIO without a heavy SDK dependency.

function hmac(key: crypto.BinaryLike | Buffer, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data: crypto.BinaryLike) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function s3Config() {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = env.storage.s3;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new AppError(
      "Cloud storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
      500,
      "STORAGE_NOT_CONFIGURED",
    );
  }
  return { endpoint: endpoint.replace(/\/$/, ""), region: region || "auto", bucket, accessKeyId, secretAccessKey };
}

function signedRequest(method: string, key: string, body: Buffer | "", contentType?: string) {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = s3Config();
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body === "" ? "" : body);

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h]}\n`)
    .join("");

  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url: url.toString(), headers };
}

async function s3Put(key: string, contentType: string, data: Buffer) {
  const { url, headers } = signedRequest("PUT", key, data, contentType);
  const res = await fetch(url, { method: "PUT", headers, body: new Uint8Array(data) });
  if (!res.ok) throw new AppError(`Upload failed (${res.status}).`, 502, "STORAGE_ERROR");
}

async function s3Get(key: string): Promise<Buffer> {
  const { url, headers } = signedRequest("GET", key, "");
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) throw new AppError("File could not be retrieved.", 404, "NOT_FOUND");
  return Buffer.from(await res.arrayBuffer());
}

async function s3Delete(key: string) {
  const { url, headers } = signedRequest("DELETE", key, "");
  await fetch(url, { method: "DELETE", headers });
}
