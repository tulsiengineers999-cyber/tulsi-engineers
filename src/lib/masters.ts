/** Factory service-type list. Admins may add, rename or deactivate any of these. */
export const SERVICE_TYPES: { name: string; category: string }[] = [
  { name: "Boiler Service", category: "Boiler" },
  { name: "Boiler Repair", category: "Boiler" },
  { name: "Boiler Maintenance", category: "Boiler" },
  { name: "Boiler Inspection", category: "Boiler" },
  { name: "Boiler Erection", category: "Boiler" },
  { name: "Boiler Commissioning", category: "Boiler" },
  { name: "Boiler Breakdown Service", category: "Boiler" },
  { name: "Boiler Tube Replacement", category: "Boiler" },
  { name: "Boiler Cleaning", category: "Boiler" },
  { name: "Boiler Refractory Work", category: "Boiler" },
  { name: "Boiler Insulation Work", category: "Boiler" },
  { name: "Thermic Fluid Heater Service", category: "Thermic Fluid Heater" },
  { name: "Thermic Fluid Heater Repair", category: "Thermic Fluid Heater" },
  { name: "Thermic Fluid Heater Maintenance", category: "Thermic Fluid Heater" },
  { name: "Steam Generator Service", category: "Generator" },
  { name: "Hot Air Generator Service", category: "Generator" },
  { name: "Hot Water Generator Service", category: "Generator" },
  { name: "Chimney Inspection", category: "Chimney" },
  { name: "Chimney Repair", category: "Chimney" },
  { name: "Chimney Fabrication", category: "Chimney" },
  { name: "Chimney Erection", category: "Chimney" },
  { name: "Piping Work", category: "Piping" },
  { name: "Oil Piping", category: "Piping" },
  { name: "Steam Piping", category: "Piping" },
  { name: "Feedwater Piping", category: "Piping" },
  { name: "Blowdown Piping", category: "Piping" },
  { name: "Condensate Piping", category: "Piping" },
  { name: "Pollution Control Equipment Service", category: "Pollution Control" },
  { name: "Bag Filter Service", category: "Pollution Control" },
  { name: "Dust Collector Service", category: "Pollution Control" },
  { name: "Scrubber Service", category: "Pollution Control" },
  { name: "Cyclone Service", category: "Pollution Control" },
  { name: "Venturi Scrubber Service", category: "Pollution Control" },
  { name: "Pump Service", category: "Accessories" },
  { name: "Burner Service", category: "Accessories" },
  { name: "Control Panel Service", category: "Accessories" },
  { name: "AMC Service", category: "Contract" },
  { name: "Preventive Maintenance", category: "Contract" },
  { name: "Breakdown Service", category: "Contract" },
  { name: "Fabrication Work", category: "General" },
  { name: "Site Visit", category: "General" },
  { name: "Technical Inspection", category: "General" },
  { name: "Other", category: "General" },
];

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  BOILER: "Boiler",
  STEAM_BOILER: "Steam Boiler",
  THERMIC_FLUID_HEATER: "Thermic Fluid Heater",
  STEAM_GENERATOR: "Steam Generator",
  HOT_AIR_GENERATOR: "Hot Air Generator",
  HOT_WATER_GENERATOR: "Hot Water Generator",
  CHIMNEY: "Chimney",
  POLLUTION_CONTROL_EQUIPMENT: "Pollution Control Equipment",
  PRESSURE_VESSEL: "Pressure Vessel",
  PIPING: "Piping",
  PUMP: "Pump",
  BURNER: "Burner",
  CONTROL_PANEL: "Control Panel",
  OTHER: "Other",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  SITE_VISIT: "Site Visit",
  MOM_CREATED: "MOM Created",
  WORK_STARTED: "Work Started",
  WORK_IN_PROGRESS: "Work In Progress",
  CONFIRMATION_PENDING: "Confirmation Pending",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const JOB_STATUS_FLOW: string[] = [
  "NEW",
  "ASSIGNED",
  "SITE_VISIT",
  "MOM_CREATED",
  "WORK_STARTED",
  "WORK_IN_PROGRESS",
  "CONFIRMATION_PENDING",
  "COMPLETED",
  "CLOSED",
];

export const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PDF_GENERATED: "PDF Generated",
  SENT_TO_CLIENT: "Sent to Client",
  CONFIRMATION_PENDING: "Confirmation Pending",
  CLIENT_CONFIRMED: "Client Confirmed",
  CORRECTION_REQUESTED: "Correction Requested",
  CLOSED: "Closed",
};

export const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  BEFORE_WORK: "Before Work",
  DURING_WORK: "During Work",
  AFTER_WORK: "After Work",
  EQUIPMENT: "Equipment",
  DAMAGE: "Damage",
  REPAIR: "Repair",
  INSTALLATION: "Installation",
  TESTING: "Testing",
  COMPLETED_WORK: "Completed Work",
  OTHER: "Other",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ACTION_POINT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  MOM: "Minutes of Meeting",
  DAILY_WORK_REPORT: "Daily Work Report",
  FINAL_SERVICE_REPORT: "Final Service Report",
  SITE_VISIT_REPORT: "Site Visit Report",
  AMC_REPORT: "AMC Report",
  INSPECTION_REPORT: "Inspection Report",
};

export const RESPONSIBLE_PARTY_LABELS: Record<string, string> = {
  TULSI_ENGINEERS: "TULSI ENGINEERS",
  CUSTOMER: "Customer",
  THIRD_PARTY: "Third Party",
};

export const AMC_STATUS_LABELS: Record<string, string> = {
  UNDER_AMC: "Under AMC",
  NOT_UNDER_AMC: "Not Under AMC",
  EXPIRED: "AMC Expired",
  PROPOSED: "AMC Proposed",
};
