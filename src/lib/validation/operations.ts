import { z } from "zod";
import { dateish } from "./masters";

const optional = (max = 5000) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);

export const jobSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  siteId: z.string().min(1, "Site is required"),
  equipmentId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  serviceTypeId: z.string().min(1, "Service type is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  requestDate: dateish,
  plannedVisitDate: dateish,
  targetCompletionDate: dateish,
  engineerId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  technicianId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  customerRequirement: optional(),
  problemDescription: optional(),
  jobDescription: optional(),
  requiredMaterial: optional(2000),
  requiredSpare: optional(2000),
  remarks: optional(2000),
});

export const jobStatusSchema = z.object({
  status: z.enum([
    "NEW", "ASSIGNED", "SITE_VISIT", "MOM_CREATED", "WORK_STARTED",
    "WORK_IN_PROGRESS", "CONFIRMATION_PENDING", "COMPLETED", "CLOSED", "CANCELLED",
  ]),
  remarks: optional(1000),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
});

export const assignSchema = z.object({
  engineerId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  technicianId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  plannedVisitDate: dateish,
  remarks: optional(1000),
  notify: z.boolean().default(true),
});

export const visitSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  visitDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  arrivalTime: optional(10),
  departureTime: optional(10),
  engineerId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  technicianNames: optional(500),
  customerRepresentative: optional(500),
  purpose: optional(),
  equipmentDetails: optional(),
  problemObserved: optional(),
  initialObservation: optional(),
  requiredAction: optional(),
  materialRequired: optional(2000),
  spareRequired: optional(2000),
  siteCondition: optional(2000),
  remarks: optional(2000),
});

export const momParticipantSchema = z.object({
  name: z.string().trim().min(2, "Participant name is required").max(120),
  designation: optional(120),
  company: optional(160),
  party: z.enum(["TULSI_ENGINEERS", "CUSTOMER", "THIRD_PARTY"]).default("TULSI_ENGINEERS"),
  mobile: optional(20),
  email: optional(160),
});

export const momActionPointSchema = z.object({
  id: z.string().optional(),
  sequence: z.coerce.number().int().min(1).default(1),
  actionPoint: z.string().trim().min(3, "Describe the action point").max(2000),
  responsiblePerson: optional(120),
  responsibleParty: z.enum(["TULSI_ENGINEERS", "CUSTOMER", "THIRD_PARTY"]).default("TULSI_ENGINEERS"),
  responsibleCompany: optional(160),
  dueDate: dateish,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"]).default("OPEN"),
  remarks: optional(1000),
});

export const momSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  siteVisitId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  meetingDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  meetingTime: optional(10),
  location: optional(300),
  equipmentDetails: optional(),
  purpose: optional(),
  discussionPoints: optional(20000),
  technicalObservations: optional(20000),
  problemsIdentified: optional(20000),
  decisionsTaken: optional(20000),
  requiredMaterials: optional(),
  requiredSpares: optional(),
  pendingPoints: optional(),
  recommendations: optional(),
  clientRemarks: optional(),
  participants: z.array(momParticipantSchema).default([]),
  actionPoints: z.array(momActionPointSchema).default([]),
});

export const workLineSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  specification: optional(300),
  partNumber: optional(120),
  make: optional(120),
  quantity: z.coerce.number().min(0).default(1),
  unit: optional(30),
  remarks: optional(300),
});

export const dailyReportSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  reportDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  engineerId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  technicianNames: optional(500),
  startTime: optional(10),
  endTime: optional(10),
  workHours: z.coerce.number().min(0).max(24).optional().nullable(),
  progressPercent: z.coerce.number().int().min(0).max(100).default(0),
  workPerformed: optional(20000),
  toolsUsed: optional(2000),
  technicalFindings: optional(20000),
  problems: optional(),
  pendingWork: optional(),
  nextAction: optional(),
  recommendations: optional(),
  remarks: optional(),
  materials: z.array(workLineSchema).default([]),
  spares: z.array(workLineSchema).default([]),
});

export const finalReportSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  workStartDate: dateish,
  workEndDate: dateish,
  engineerName: optional(200),
  technicianNames: optional(500),
  workPerformed: optional(30000),
  materialsSummary: optional(),
  sparesSummary: optional(),
  testingDetails: optional(20000),
  observations: optional(20000),
  pendingWork: optional(),
  recommendations: optional(),
  finalRemarks: optional(),
  completionDate: dateish,
});

export const sendSchema = z.object({
  channels: z.array(z.enum(["EMAIL", "WHATSAPP"])).min(1, "Select at least one channel"),
  toEmail: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
  toWhatsapp: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
  cc: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
  message: optional(2000),
  attachPdf: z.boolean().default(true),
  allowCorrection: z.boolean().default(true),
});

export const photoMetaSchema = z.object({
  category: z.enum([
    "BEFORE_WORK", "DURING_WORK", "AFTER_WORK", "EQUIPMENT", "DAMAGE",
    "REPAIR", "INSTALLATION", "TESTING", "COMPLETED_WORK", "OTHER",
  ]).default("OTHER"),
  description: optional(500),
  jobId: z.string().optional(),
  siteVisitId: z.string().optional(),
  momId: z.string().optional(),
  dailyReportId: z.string().optional(),
  finalReportId: z.string().optional(),
  equipmentId: z.string().optional(),
});
