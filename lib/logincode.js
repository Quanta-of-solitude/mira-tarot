import { createHash, randomInt } from "node:crypto";

export const CODE_TTL_MIN = 10, RESEND_AFTER_S = 45, MAX_ATTEMPTS = 5;

export function normEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  return /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 200 ? e : null;
}
export const newCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export function hashCode(email, code) {
  const salt = process.env.AUTH_SECRET || "dev-only-secret-not-for-production";
  return createHash("sha256").update(`${salt}:${email}:${code}`).digest("hex");
}
