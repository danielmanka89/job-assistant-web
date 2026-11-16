import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { canSend, emailDomain, sendEmail } from "@/lib/email";

export const RESET_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_RESETS_PER_HOUR = 3; // per account

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return value;
}

/** HMAC of a token or code, so a copy of the database can't be used to reset anyone's password. */
export const hashSecret = (value: string, purpose: string) => createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("hex");

export const newResetToken = () => randomBytes(32).toString("base64url");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Compares a typed code with the stored hash in constant time. */
export function codeMatches(code: string, storedHash: string, purpose: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const given = Buffer.from(hashSecret(code, purpose), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export class EmailNotSetUp extends Error {}

const fromAddress = () => `no-reply@${emailDomain()}`;

/** Sends a plain-text security email. In development without email set up, prints it to the log. */
async function securityEmail(to: string, subject: string, body: string, key: string) {
  if (!canSend()) {
    if (process.env.NODE_ENV === "production") throw new EmailNotSetUp("Email sending isn't set up");
    console.info(`[dev] email to ${to}: ${subject}\n${body}`);
    return;
  }
  await sendEmail({ fromName: "Job Assistant", fromAddress: fromAddress(), to, subject, body, idempotencyKey: key });
}

export function sendResetCodeEmail(to: string, name: string, code: string, key: string) {
  return securityEmail(
    to,
    `${code} is your Job Assistant reset code`,
    `Hi ${name.split(" ")[0] || "there"},\n\nSomeone (hopefully you) asked to reset your Job Assistant password. Your code is:\n\n${code}\n\nIt expires in ${RESET_MINUTES} minutes. After it, we'll also text a code to your phone.\n\nIf this wasn't you, ignore this email: your password stays the same, and nobody can change it without your phone too.\n\nJob Assistant`,
    key,
  );
}

export function sendPasswordChangedEmail(to: string, name: string, key: string) {
  return securityEmail(
    to,
    "Your Job Assistant password was changed",
    `Hi ${name.split(" ")[0] || "there"},\n\nYour Job Assistant password was just reset, and every device was signed out.\n\nIf this wasn't you, reset your password again right away from the sign-in page, and change your email password too.\n\nJob Assistant`,
    key,
  );
}

// A light per-IP limit on starting resets (per server instance), on top of the per-account limit.
const recent = new Map<string, number[]>();
export function tooManyFromIp(ip: string, limit = 10, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > limit;
}

export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
