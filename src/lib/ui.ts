import type { BadgeTone } from "@/components/ui/primitives";

export const JOB_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "neutral",
  ASSIGNED: "info",
  SITE_VISIT: "info",
  MOM_CREATED: "primary",
  WORK_STARTED: "accent",
  WORK_IN_PROGRESS: "accent",
  CONFIRMATION_PENDING: "warning",
  COMPLETED: "success",
  CLOSED: "success",
  CANCELLED: "danger",
};

export const DOC_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  PDF_GENERATED: "info",
  SENT_TO_CLIENT: "primary",
  CONFIRMATION_PENDING: "warning",
  CLIENT_CONFIRMED: "success",
  CORRECTION_REQUESTED: "danger",
  CLOSED: "neutral",
};

export const PRIORITY_TONE: Record<string, BadgeTone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export const ACTION_POINT_TONE: Record<string, BadgeTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  ON_HOLD: "neutral",
  CANCELLED: "danger",
};

export const CONFIRMATION_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CORRECTION_REQUESTED: "danger",
  EXPIRED: "neutral",
};

export const CHANNEL_TONE: Record<string, BadgeTone> = {
  QUEUED: "neutral",
  SENT: "info",
  DELIVERED: "success",
  READ: "success",
  FAILED: "danger",
};

export const AMC_TONE: Record<string, BadgeTone> = {
  UNDER_AMC: "success",
  NOT_UNDER_AMC: "neutral",
  EXPIRED: "danger",
  PROPOSED: "warning",
};
