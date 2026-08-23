import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

export function checkPasswordStrength(pw: string): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("Must be at least 8 characters long");
  if (!/[A-Za-z]/.test(pw)) problems.push("Must contain at least one letter");
  if (!/[0-9]/.test(pw)) problems.push("Must contain at least one number");
  if (/^\s|\s$/.test(pw)) problems.push("Must not start or end with a space");
  return { ok: problems.length === 0, problems };
}
