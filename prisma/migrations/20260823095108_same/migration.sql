-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isEngineer" BOOLEAN NOT NULL DEFAULT false,
    "isTechnician" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "altEmail" TEXT,
    "gstNumber" TEXT,
    "industry" TEXT,
    "billingAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "contactPerson" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "siteType" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "typeOther" TEXT,
    "name" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "capacity" TEXT,
    "fuelType" TEXT,
    "installationDate" DATETIME,
    "commissioningDate" DATETIME,
    "warrantyUpto" DATETIME,
    "amcStatus" TEXT NOT NULL DEFAULT 'NOT_UNDER_AMC',
    "amcValidUpto" DATETIME,
    "specifications" JSONB,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "equipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "service_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "serviceTypeId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedVisitDate" DATETIME,
    "targetCompletionDate" DATETIME,
    "completedAt" DATETIME,
    "engineerId" TEXT,
    "technicianId" TEXT,
    "customerRequirement" TEXT,
    "problemDescription" TEXT,
    "jobDescription" TEXT,
    "requiredMaterial" TEXT,
    "requiredSpare" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "sourceActionPointId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "service_jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_jobs_sourceActionPointId_fkey" FOREIGN KEY ("sourceActionPointId") REFERENCES "mom_action_points" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_status_history_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "unassignedAt" DATETIME,
    "remarks" TEXT,
    CONSTRAINT "job_assignments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitNumber" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL,
    "arrivalTime" TEXT,
    "departureTime" TEXT,
    "engineerId" TEXT,
    "technicianNames" TEXT,
    "customerRepresentative" TEXT,
    "purpose" TEXT,
    "equipmentDetails" TEXT,
    "problemObserved" TEXT,
    "initialObservation" TEXT,
    "requiredAction" TEXT,
    "materialRequired" TEXT,
    "spareRequired" TEXT,
    "siteCondition" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "site_visits_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "site_visits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "site_visits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "site_visits_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "moms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "momNumber" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "siteVisitId" TEXT,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "meetingDate" DATETIME NOT NULL,
    "meetingTime" TEXT,
    "location" TEXT,
    "equipmentDetails" TEXT,
    "purpose" TEXT,
    "discussionPoints" TEXT,
    "technicalObservations" TEXT,
    "problemsIdentified" TEXT,
    "decisionsTaken" TEXT,
    "requiredMaterials" TEXT,
    "requiredSpares" TEXT,
    "pendingPoints" TEXT,
    "recommendations" TEXT,
    "clientRemarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lockedAt" DATETIME,
    "submittedAt" DATETIME,
    "sentAt" DATETIME,
    "confirmedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "moms_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "moms_siteVisitId_fkey" FOREIGN KEY ("siteVisitId") REFERENCES "site_visits" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "moms_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "moms_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "moms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mom_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "momId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "company" TEXT,
    "party" TEXT NOT NULL DEFAULT 'TULSI_ENGINEERS',
    "mobile" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mom_participants_momId_fkey" FOREIGN KEY ("momId") REFERENCES "moms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mom_action_points" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "momId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "actionPoint" TEXT NOT NULL,
    "responsiblePerson" TEXT,
    "responsibleParty" TEXT NOT NULL DEFAULT 'TULSI_ENGINEERS',
    "responsibleCompany" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" DATETIME,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mom_action_points_momId_fkey" FOREIGN KEY ("momId") REFERENCES "moms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_work_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportNumber" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "engineerId" TEXT,
    "technicianNames" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "workHours" REAL,
    "workPerformed" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "toolsUsed" TEXT,
    "technicalFindings" TEXT,
    "problems" TEXT,
    "pendingWork" TEXT,
    "nextAction" TEXT,
    "recommendations" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lockedAt" DATETIME,
    "submittedAt" DATETIME,
    "sentAt" DATETIME,
    "confirmedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_work_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_work_reports_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_materials_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_work_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_spares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "make" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_spares_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_work_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "final_service_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportNumber" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workStartDate" DATETIME,
    "workEndDate" DATETIME,
    "engineerName" TEXT,
    "technicianNames" TEXT,
    "workPerformed" TEXT,
    "materialsSummary" TEXT,
    "sparesSummary" TEXT,
    "testingDetails" TEXT,
    "observations" TEXT,
    "pendingWork" TEXT,
    "recommendations" TEXT,
    "finalRemarks" TEXT,
    "completionDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lockedAt" DATETIME,
    "submittedAt" DATETIME,
    "sentAt" DATETIME,
    "confirmedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "final_service_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "final_service_reports_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "final_service_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "description" TEXT,
    "capturedAt" DATETIME,
    "uploadedById" TEXT,
    "jobId" TEXT,
    "siteVisitId" TEXT,
    "momId" TEXT,
    "dailyReportId" TEXT,
    "finalReportId" TEXT,
    "equipmentId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "photos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_siteVisitId_fkey" FOREIGN KEY ("siteVisitId") REFERENCES "site_visits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_momId_fkey" FOREIGN KEY ("momId") REFERENCES "moms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_work_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_finalReportId_fkey" FOREIGN KEY ("finalReportId") REFERENCES "final_service_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "customerId" TEXT,
    "siteId" TEXT,
    "equipmentId" TEXT,
    "jobId" TEXT,
    "siteVisitId" TEXT,
    "momId" TEXT,
    "dailyReportId" TEXT,
    "finalReportId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "service_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_siteVisitId_fkey" FOREIGN KEY ("siteVisitId") REFERENCES "site_visits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_momId_fkey" FOREIGN KEY ("momId") REFERENCES "moms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_work_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_finalReportId_fkey" FOREIGN KEY ("finalReportId") REFERENCES "final_service_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pdf_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "generatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "client_report_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerId" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientMobile" TEXT,
    "recipientEmail" TEXT,
    "allowCorrection" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "firstViewedAt" DATETIME,
    "lastViewedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "client_confirmations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT,
    "docType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerId" TEXT NOT NULL,
    "clientName" TEXT,
    "clientMobile" TEXT,
    "clientEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationChannel" TEXT,
    "correctionRemarks" TEXT,
    "confirmedAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_confirmations_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "client_report_links" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purpose" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "docType" TEXT,
    "recordId" TEXT,
    "linkId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "consumedAt" DATETIME,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "variables" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "bodyPreview" TEXT,
    "variables" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT,
    "toEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "bccEmail" TEXT,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "docType" TEXT,
    "recordId" TEXT,
    "recordNumber" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "errorMessage" TEXT,
    "attachments" JSONB,
    "sentById" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "whatsapp_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT,
    "templateName" TEXT,
    "toNumber" TEXT NOT NULL,
    "payload" JSONB,
    "bodyPreview" TEXT,
    "docType" TEXT,
    "recordId" TEXT,
    "recordNumber" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentById" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "recordId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT,
    "recordLabel" TEXT,
    "description" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT,
    "description" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");

-- CreateIndex
CREATE INDEX "login_history_createdAt_idx" ON "login_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_companyName_idx" ON "customers"("companyName");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customer_contacts_customerId_idx" ON "customer_contacts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE INDEX "sites_customerId_idx" ON "sites"("customerId");

-- CreateIndex
CREATE INDEX "sites_name_idx" ON "sites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_customerId_idx" ON "equipment"("customerId");

-- CreateIndex
CREATE INDEX "equipment_siteId_idx" ON "equipment"("siteId");

-- CreateIndex
CREATE INDEX "equipment_serialNumber_idx" ON "equipment"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "service_types_name_key" ON "service_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_jobs_jobNumber_key" ON "service_jobs"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "service_jobs_sourceActionPointId_key" ON "service_jobs"("sourceActionPointId");

-- CreateIndex
CREATE INDEX "service_jobs_customerId_idx" ON "service_jobs"("customerId");

-- CreateIndex
CREATE INDEX "service_jobs_siteId_idx" ON "service_jobs"("siteId");

-- CreateIndex
CREATE INDEX "service_jobs_status_idx" ON "service_jobs"("status");

-- CreateIndex
CREATE INDEX "service_jobs_engineerId_idx" ON "service_jobs"("engineerId");

-- CreateIndex
CREATE INDEX "service_jobs_plannedVisitDate_idx" ON "service_jobs"("plannedVisitDate");

-- CreateIndex
CREATE INDEX "job_status_history_jobId_idx" ON "job_status_history"("jobId");

-- CreateIndex
CREATE INDEX "job_assignments_jobId_idx" ON "job_assignments"("jobId");

-- CreateIndex
CREATE INDEX "job_assignments_userId_idx" ON "job_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "site_visits_visitNumber_key" ON "site_visits"("visitNumber");

-- CreateIndex
CREATE INDEX "site_visits_jobId_idx" ON "site_visits"("jobId");

-- CreateIndex
CREATE INDEX "site_visits_visitDate_idx" ON "site_visits"("visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "moms_momNumber_key" ON "moms"("momNumber");

-- CreateIndex
CREATE INDEX "moms_jobId_idx" ON "moms"("jobId");

-- CreateIndex
CREATE INDEX "moms_status_idx" ON "moms"("status");

-- CreateIndex
CREATE INDEX "moms_meetingDate_idx" ON "moms"("meetingDate");

-- CreateIndex
CREATE INDEX "mom_participants_momId_idx" ON "mom_participants"("momId");

-- CreateIndex
CREATE INDEX "mom_action_points_momId_idx" ON "mom_action_points"("momId");

-- CreateIndex
CREATE INDEX "mom_action_points_status_idx" ON "mom_action_points"("status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_work_reports_reportNumber_key" ON "daily_work_reports"("reportNumber");

-- CreateIndex
CREATE INDEX "daily_work_reports_jobId_idx" ON "daily_work_reports"("jobId");

-- CreateIndex
CREATE INDEX "daily_work_reports_reportDate_idx" ON "daily_work_reports"("reportDate");

-- CreateIndex
CREATE INDEX "daily_work_reports_status_idx" ON "daily_work_reports"("status");

-- CreateIndex
CREATE INDEX "work_materials_dailyReportId_idx" ON "work_materials"("dailyReportId");

-- CreateIndex
CREATE INDEX "work_spares_dailyReportId_idx" ON "work_spares"("dailyReportId");

-- CreateIndex
CREATE UNIQUE INDEX "final_service_reports_reportNumber_key" ON "final_service_reports"("reportNumber");

-- CreateIndex
CREATE INDEX "final_service_reports_jobId_idx" ON "final_service_reports"("jobId");

-- CreateIndex
CREATE INDEX "final_service_reports_status_idx" ON "final_service_reports"("status");

-- CreateIndex
CREATE INDEX "photos_jobId_idx" ON "photos"("jobId");

-- CreateIndex
CREATE INDEX "photos_momId_idx" ON "photos"("momId");

-- CreateIndex
CREATE INDEX "photos_dailyReportId_idx" ON "photos"("dailyReportId");

-- CreateIndex
CREATE INDEX "photos_category_idx" ON "photos"("category");

-- CreateIndex
CREATE INDEX "documents_jobId_idx" ON "documents"("jobId");

-- CreateIndex
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");

-- CreateIndex
CREATE INDEX "pdf_documents_recordId_idx" ON "pdf_documents"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_documents_docType_recordId_version_key" ON "pdf_documents"("docType", "recordId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "client_report_links_tokenHash_key" ON "client_report_links"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "client_report_links_tokenPrefix_key" ON "client_report_links"("tokenPrefix");

-- CreateIndex
CREATE INDEX "client_report_links_docType_recordId_idx" ON "client_report_links"("docType", "recordId");

-- CreateIndex
CREATE INDEX "client_report_links_customerId_idx" ON "client_report_links"("customerId");

-- CreateIndex
CREATE INDEX "client_confirmations_docType_recordId_idx" ON "client_confirmations"("docType", "recordId");

-- CreateIndex
CREATE INDEX "client_confirmations_customerId_idx" ON "client_confirmations"("customerId");

-- CreateIndex
CREATE INDEX "client_confirmations_status_idx" ON "client_confirmations"("status");

-- CreateIndex
CREATE INDEX "otp_verifications_purpose_recordId_idx" ON "otp_verifications"("purpose", "recordId");

-- CreateIndex
CREATE INDEX "otp_verifications_destination_idx" ON "otp_verifications"("destination");

-- CreateIndex
CREATE INDEX "otp_verifications_expiresAt_idx" ON "otp_verifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_code_key" ON "email_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_code_key" ON "whatsapp_templates"("code");

-- CreateIndex
CREATE INDEX "email_logs_recordId_idx" ON "email_logs"("recordId");

-- CreateIndex
CREATE INDEX "email_logs_customerId_idx" ON "email_logs"("customerId");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "whatsapp_logs_recordId_idx" ON "whatsapp_logs"("recordId");

-- CreateIndex
CREATE INDEX "whatsapp_logs_customerId_idx" ON "whatsapp_logs"("customerId");

-- CreateIndex
CREATE INDEX "whatsapp_logs_status_idx" ON "whatsapp_logs"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_recordId_idx" ON "audit_logs"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_group_idx" ON "system_settings"("group");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_key_fiscalYear_key" ON "number_sequences"("key", "fiscalYear");
