import { z } from "zod";

const optional = (max = 500) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);
const email = z.string().trim().email("Enter a valid email address").optional().or(z.literal("")).transform((v) => v || undefined);
const mobile = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

export const dateish = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return undefined;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

export const customerSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  contactPerson: optional(120),
  department: optional(120),
  designation: optional(120),
  mobile,
  whatsapp: mobile,
  email,
  altEmail: email,
  gstNumber: z.string().trim().max(20).optional().or(z.literal("")).transform((v) => v?.toUpperCase() || undefined),
  industry: optional(120),
  billingAddress: optional(1000),
  city: optional(80),
  state: optional(80),
  pinCode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits").optional().or(z.literal("")).transform((v) => v || undefined),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  remarks: optional(2000),
});

export const customerContactSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  name: z.string().trim().min(2, "Name is required").max(120),
  designation: optional(120),
  department: optional(120),
  mobile,
  whatsapp: mobile,
  email,
  isPrimary: z.boolean().default(false),
  remarks: optional(500),
});

export const siteSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  name: z.string().trim().min(2, "Site name is required").max(200),
  address: optional(1000),
  city: optional(80),
  state: optional(80),
  pinCode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits").optional().or(z.literal("")).transform((v) => v || undefined),
  contactPerson: optional(120),
  mobile,
  whatsapp: mobile,
  email,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  siteType: optional(80),
  remarks: optional(2000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const equipmentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  siteId: z.string().min(1, "Site is required"),
  type: z.enum([
    "BOILER", "STEAM_BOILER", "THERMIC_FLUID_HEATER", "STEAM_GENERATOR", "HOT_AIR_GENERATOR",
    "HOT_WATER_GENERATOR", "CHIMNEY", "POLLUTION_CONTROL_EQUIPMENT", "PRESSURE_VESSEL",
    "PIPING", "PUMP", "BURNER", "CONTROL_PANEL", "OTHER",
  ]).default("OTHER"),
  typeOther: optional(120),
  name: z.string().trim().min(2, "Equipment name is required").max(200),
  make: optional(120),
  model: optional(120),
  serialNumber: optional(120),
  capacity: optional(120),
  fuelType: optional(120),
  installationDate: dateish,
  commissioningDate: dateish,
  warrantyUpto: dateish,
  amcStatus: z.enum(["UNDER_AMC", "NOT_UNDER_AMC", "EXPIRED", "PROPOSED"]).default("NOT_UNDER_AMC"),
  amcValidUpto: dateish,
  specifications: z.record(z.string(), z.string()).optional(),
  remarks: optional(2000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const serviceTypeSchema = z.object({
  name: z.string().trim().min(2, "Service name is required").max(120),
  category: optional(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(100),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
  username: z.string().trim().min(3).max(40).regex(/^[a-z0-9._-]+$/i, "Letters, numbers, dot, dash and underscore only").optional().or(z.literal("")).transform((v) => v?.toLowerCase() || undefined),
  employeeCode: optional(40),
  mobile,
  whatsapp: mobile,
  designation: optional(120),
  department: optional(120),
  roleId: z.string().min(1, "Role is required"),
  isEngineer: z.boolean().default(false),
  isTechnician: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).default("ACTIVE"),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")).transform((v) => v || undefined),
  mustChangePassword: z.boolean().default(false),
});

export const roleSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/, "Use capital letters, numbers and underscores"),
  name: z.string().trim().min(2, "Role name is required").max(80),
  description: optional(500),
  rank: z.coerce.number().int().min(1).max(999).default(100),
  permissions: z.array(z.string()).default([]),
});
