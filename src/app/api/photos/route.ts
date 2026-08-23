import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { putFile, validateUpload } from "@/lib/storage";
import { photoMetaSchema } from "@/lib/validation/operations";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requirePermission("photos.view");
    const { skip, take, page, pageSize, params, q } = parseListParams(req.url, { pageSize: 48 });

    const where: Prisma.PhotoWhereInput = {
      deletedAt: null,
      ...(params.get("jobId") ? { jobId: params.get("jobId")! } : {}),
      ...(params.get("momId") ? { momId: params.get("momId")! } : {}),
      ...(params.get("siteVisitId") ? { siteVisitId: params.get("siteVisitId")! } : {}),
      ...(params.get("dailyReportId") ? { dailyReportId: params.get("dailyReportId")! } : {}),
      ...(params.get("finalReportId") ? { finalReportId: params.get("finalReportId")! } : {}),
      ...(params.get("equipmentId") ? { equipmentId: params.get("equipmentId")! } : {}),
      ...(params.get("category") ? { category: params.get("category") as never } : {}),
      ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { fileName: { contains: q, mode: "insensitive" } }] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.photo.findMany({
        where, skip, take,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true, site: { select: { name: true } }, customer: { select: { companyName: true } } } },
        },
      }),
      prisma.photo.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

/** Multipart upload. Accepts one or many files in the `files` field. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("photos.create");
    const form = await req.formData();

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) throw Errors.validation("Select at least one photo to upload.");
    if (files.length > 40) throw Errors.validation("You can upload a maximum of 40 photos at a time.");

    const meta = photoMetaSchema.parse({
      category: form.get("category") ?? "OTHER",
      description: form.get("description") ?? "",
      jobId: form.get("jobId") ?? undefined,
      siteVisitId: form.get("siteVisitId") ?? undefined,
      momId: form.get("momId") ?? undefined,
      dailyReportId: form.get("dailyReportId") ?? undefined,
      finalReportId: form.get("finalReportId") ?? undefined,
      equipmentId: form.get("equipmentId") ?? undefined,
    });

    if (!meta.jobId && !meta.siteVisitId && !meta.momId && !meta.dailyReportId && !meta.finalReportId && !meta.equipmentId) {
      throw Errors.validation("A photo must be attached to a job, visit, MOM, report or equipment record.");
    }

    const saved = [];
    for (const file of files) {
      validateUpload({ type: file.type, size: file.size }, "image");
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await putFile("photos", file.name, file.type, buffer);

      saved.push(
        await prisma.photo.create({
          data: {
            category: meta.category,
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            description: meta.description ?? null,
            capturedAt: new Date(file.lastModified || Date.now()),
            uploadedById: user.id,
            jobId: meta.jobId ?? null,
            siteVisitId: meta.siteVisitId ?? null,
            momId: meta.momId ?? null,
            dailyReportId: meta.dailyReportId ?? null,
            finalReportId: meta.finalReportId ?? null,
            equipmentId: meta.equipmentId ?? null,
          },
        }),
      );
    }

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "photos",
      recordId: meta.jobId ?? meta.momId ?? meta.dailyReportId ?? null,
      description: `Uploaded ${saved.length} photo(s) — ${meta.category}`,
    });

    return created(saved);
  } catch (e) {
    return fail(e);
  }
}
