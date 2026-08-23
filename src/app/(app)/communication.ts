/**
 * Shared helpers for the Email History, WhatsApp History and Client
 * Confirmations screens.
 */

/**
 * A log row is "simulated" when the driver was in LOG mode: the message was
 * recorded for the audit trail but never actually transmitted. The services
 * record that fact in `errorMessage` while still marking the row SENT, so the
 * history stays complete.
 */
export function isSimulated(status: string, errorMessage: string | null): boolean {
  return status === "SENT" && Boolean(errorMessage?.includes("recorded but not transmitted"));
}

/** Where each document type lives in the admin interface. */
export const DOC_ROUTE: Record<string, string> = {
  MOM: "/mom",
  DAILY_WORK_REPORT: "/daily-reports",
  FINAL_SERVICE_REPORT: "/final-reports",
  SITE_VISIT_REPORT: "/visits",
  AMC_REPORT: "/final-reports",
  INSPECTION_REPORT: "/visits",
};
