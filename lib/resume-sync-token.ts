import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { ResumeDraft } from "@/lib/types";

// The token POST /api/resume/compare hands out and /api/resume/confirm-sync checks. It binds the
// user, the exact file bytes and the parsed draft, so confirm-sync can save the draft without
// parsing the file again and without trusting a draft the client changed or a different file.

const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return value;
}

/** JSON with object keys sorted, so the same data always gives the same string. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function mac(userId: string, issuedAt: number, bytes: Uint8Array, draft: ResumeDraft): string {
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  return createHmac("sha256", secret()).update(`resume-sync\n${userId}\n${issuedAt}\n${fileHash}\n${stableJson(draft)}`).digest("base64url");
}

export function signResumeSync(userId: string, bytes: Uint8Array, draft: ResumeDraft, now = Date.now()): string {
  return `${now}.${mac(userId, now, bytes, draft)}`;
}

/** "ok", or why the token can't be used. */
export function checkResumeSync(token: string, userId: string, bytes: Uint8Array, draft: ResumeDraft, now = Date.now()): "ok" | "expired" | "mismatch" {
  const [issued, signature] = token.split(".");
  const issuedAt = Number(issued);
  if (!signature || !Number.isSafeInteger(issuedAt)) return "mismatch";
  const expected = Buffer.from(mac(userId, issuedAt, bytes, draft));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "mismatch";
  return now - issuedAt > MAX_AGE_MS || issuedAt > now + 60_000 ? "expired" : "ok";
}
