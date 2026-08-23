import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

export async function GET() {
  try {
    await requirePermission("backup.view");

    const [
      customers,
      sites,
      equipment,
      serviceTypes,
      jobs,
      visits,
      moms,
      dailyReports,
      finalReports,
      users,
      photoAgg,
      documentAgg,
      pdfAgg,
      customerDates,
      jobDates,
    ] = await prisma.$transaction([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.site.count({ where: { deletedAt: null } }),
      prisma.equipment.count({ where: { deletedAt: null } }),
      prisma.serviceType.count({ where: { deletedAt: null } }),
      prisma.serviceJob.count({ where: { deletedAt: null } }),
      prisma.siteVisit.count({ where: { deletedAt: null } }),
      prisma.mom.count({ where: { deletedAt: null } }),
      prisma.dailyWorkReport.count({ where: { deletedAt: null } }),
      prisma.finalServiceReport.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.photo.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { sizeBytes: true } }),
      prisma.document.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { sizeBytes: true } }),
      prisma.pdfDocument.aggregate({ _count: { _all: true }, _sum: { sizeBytes: true } }),
      prisma.customer.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
      prisma.serviceJob.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
    ]);

    const oldestCandidates = [customerDates._min.createdAt, jobDates._min.createdAt].filter(Boolean) as Date[];
    const newestCandidates = [customerDates._max.createdAt, jobDates._max.createdAt].filter(Boolean) as Date[];

    return ok({
      rowCounts: {
        customers,
        sites,
        equipment,
        serviceTypes,
        jobs,
        visits,
        moms,
        dailyReports,
        finalReports,
        users,
      },
      storage: {
        fileCount: photoAgg._count._all + documentAgg._count._all + pdfAgg._count._all,
        totalBytes: (photoAgg._sum.sizeBytes ?? 0) + (documentAgg._sum.sizeBytes ?? 0) + (pdfAgg._sum.sizeBytes ?? 0),
      },
      oldestRecordAt: oldestCandidates.length ? new Date(Math.min(...oldestCandidates.map((d) => d.getTime()))) : null,
      newestRecordAt: newestCandidates.length ? new Date(Math.max(...newestCandidates.map((d) => d.getTime()))) : null,
    });
  } catch (e) {
    return fail(e);
  }
}
