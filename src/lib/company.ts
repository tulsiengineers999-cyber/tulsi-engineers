/** Pure constants shared by server code, client components and the seed script. */

export interface CompanyProfile {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  gstNumber: string;
  logoUrl: string;
  signatureUrl: string;
  pdfFooterNote: string;
  pdfTerms: string;
}

export const DEFAULT_COMPANY: CompanyProfile = {
  name: "TULSI ENGINEERS",
  tagline:
    "Manufacturer, Supplier, Repairer & Service Provider of Industrial Boilers, Heaters, Pollution Control Equipment & Accessories",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "Gujarat",
  pinCode: "",
  country: "India",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  gstNumber: "",
  logoUrl: "",
  signatureUrl: "",
  pdfFooterNote:
    "This is a system generated document from the TULSI ENGINEERS service management system.",
  pdfTerms: "",
};

export const DEFAULT_THEME = {
  primary: "#E52B1A",
  accent: "#E52B1A",
  sidebar: "#111111",
};

export function formatCompanyAddress(c: CompanyProfile): string {
  return [c.addressLine1, c.addressLine2, c.city, c.state, c.pinCode].filter(Boolean).join(", ");
}
