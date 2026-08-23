import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

/**
 * Full JSON export of every business table. Users are included with their
 * profile fields only — passwordHash, sessions, password reset tokens and
 * OTP verifications are excluded entirely so the export can never leak a
 * credential.
 */
export async function GET() {
  try {
    const actor = await requirePermission("backup.manage");

    const [
      customers,
      customerContacts,
      sites,
      equipment,
      serviceTypes,
      jobs,
      jobAssignments,
      jobStatusHistory,
      siteVisits,
      moms,
      momParticipants,
      momActionPoints,
      dailyReports,
      workMaterials,
      workSpares,
      finalReports,
      confirmations,
      photos,
      documents,
      settings,
      emailTemplates,
      whatsappTemplates,
      users,
    ] = await Promise.all([
      prisma.customer.findMany(),
      prisma.customerContact.findMany(),
      prisma.site.findMany(),
      prisma.equipment.findMany(),
      prisma.serviceType.findMany(),
      prisma.serviceJob.findMany(),
      prisma.jobAssignment.findMany(),
      prisma.jobStatusHistory.findMany(),
      prisma.siteVisit.findMany(),
      prisma.mom.findMany(),
      prisma.momParticipant.findMany(),
      prisma.momActionPoint.findMany(),
      prisma.dailyWorkReport.findMany(),
      prisma.workMaterial.findMany(),
      prisma.workSpare.findMany(),
      prisma.finalServiceReport.findMany(),
      prisma.clientConfirmation.findMany(),
      prisma.photo.findMany(),
      prisma.document.findMany(),
      prisma.systemSetting.findMany(),
      prisma.emailTemplate.findMany(),
      prisma.whatsappTemplate.findMany(),
      prisma.user.findMany({
        select: {
          id: true,
          employeeCode: true,
          name: true,
          email: true,
          username: true,
          mobile: true,
          whatsapp: true,
          designation: true,
          department: true,
          roleId: true,
          status: true,
          isEngineer: true,
          isTechnician: true,
          mustChangePassword: true,
          lastLoginAt: true,
          passwordChangedAt: true,
          createdById: true,
          updatedById: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      appName: env.appName,
      tables: {
        customers,
        customerContacts,
        sites,
        equipment,
        serviceTypes,
        jobs,
        jobAssignments,
        jobStatusHistory,
        siteVisits,
        moms,
        momParticipants,
        momActionPoints,
        dailyReports,
        workMaterials,
        workSpares,
        finalReports,
        confirmations,
        photos,
        documents,
        settings,
        emailTemplates,
        whatsappTemplates,
        users,
      },
    };

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "EXPORT",
      module: "backup",
      description: "Full JSON backup downloaded",
    });

    const fileName = `tulsi-engineers-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
