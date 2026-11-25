import { createHmac } from "node:crypto";

/** Normalise an Indian mobile number to its 10 digits, or null if invalid. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Salted HMAC so the raw number is never stored. */
export function hashPhone(phone10: string, salt = process.env.PHONE_SALT ?? "") {
  if (!salt) throw new Error("PHONE_SALT is not set");
  return createHmac("sha256", salt).update(phone10).digest("hex");
}
