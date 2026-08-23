import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { putFile, validateUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export const maxDuration = 60;

const LINK_FIELDS = [
  "customerId",
  "siteId",
  "equipmentId",
  "jobId",
  "siteVisitId",
  "momId",
  "dailyReportId",
  "finalReportId",
] as const;

export async function GET(req: NextRequest) {
  try {
    await requirePermission("photos.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...Object.fromEntries(
        LINK_FIELDS.filter((f) => params.get(f)).map((f) => [f, params.get(f)!]),
      ),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { fileName: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          customer: { select: { id: true, companyName: true } },
          job: { select: { id: true, jobNumber: true } },
        },
      }),
      prisma.document.count({ where }),
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
    if (!files.length) throw Errors.validation("Select at least one file to upload.");
    if (files.length > 20) throw Errors.validation("You can upload a maximum of 20 files at a time.");

    const links = Object.fromEntries(
      LINK_FIELDS.map((f) => [f, (form.get(f) as string | null) || null]),
    ) as Record<(typeof LINK_FIELDS)[number], string | null>;

    if (!Object.values(links).some(Boolean)) {
      throw Errors.validation("A document must be attached to a customer, site, equipment, job or report.");
    }

    const title = (form.get("title") as string | null)?.trim() || null;
    const description = (form.get("description") as string | null)?.trim() || null;

    const saved = [];
    for (const file of files) {
      validateUpload({ type: file.type, size: file.size }, "document");
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await putFile("documents", file.name, file.type, buffer);

      saved.push(
        await prisma.document.create({
          data: {
            title: title ?? stored.fileName,
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            description,
            uploadedById: user.id,
            ...links,
          },
        }),
      );
    }

    await audit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      module: "photos",
      recordId: links.jobId ?? links.customerId ?? null,
      description: `Uploaded ${saved.length} document(s)`,
    });

    return created(saved);
  } catch (e) {
    return fail(e);
  }
}
