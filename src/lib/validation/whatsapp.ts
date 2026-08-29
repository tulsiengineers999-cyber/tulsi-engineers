export function whatsappNumberError(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "Enter a WhatsApp mobile number.";
  if (digits.startsWith("0") && digits.length === 11 && /^[6-9]\d{9}$/.test(digits.slice(1))) return null;
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]\d{9}$/.test(digits.slice(2))) return null;
  return "Enter a valid Indian mobile number: 10 digits starting with 6-9, or 0/+91 followed by 10 digits.";
}
