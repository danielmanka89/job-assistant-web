import { randomInt, timingSafeEqual } from "node:crypto";

// Texted codes, through Twilio Verify, which writes the code, sends it, expires it after 10 minutes
// and limits guesses. Needs, in Vercel:
//   TWILIO_ACCOUNT_SID          "AC…"
//   TWILIO_AUTH_TOKEN
//   TWILIO_VERIFY_SERVICE_SID   "VA…" (Twilio console → Verify → Services)
// Without them, development prints the code in the server log; production refuses (SmsNotSetUp).

export class SmsNotSetUp extends Error {}
export class SmsError extends Error {}

const sid = () => process.env.TWILIO_ACCOUNT_SID?.trim();
const token = () => process.env.TWILIO_AUTH_TOKEN?.trim();
const service = () => process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
export const canText = () => Boolean(sid() && token() && service());

// Development only: codes kept in memory, keyed by phone number.
const devCodes = new Map<string, { code: string; expires: number }>();

async function twilio(path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid()}:${token()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // 404 on a check means there's no code waiting (expired, used, or too many tries).
  if (response.status === 404) return { status: "expired" };
  if (!response.ok) throw new SmsError(typeof body.message === "string" ? body.message : `SMS service answered ${response.status}`);
  return body;
}

/** Texts a new code to the number. */
export async function sendPhoneCode(phone: string): Promise<void> {
  if (canText()) {
    await twilio("/Verifications", { To: phone, Channel: "sms" });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new SmsNotSetUp("Text messages aren't set up");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  devCodes.set(phone, { code, expires: Date.now() + 10 * 60_000 });
  console.info(`[dev] SMS code for ${phone}: ${code}`);
}

/** True when the code is the one last texted to the number (and still valid). Each code works once. */
export async function checkPhoneCode(phone: string, code: string): Promise<boolean> {
  if (!/^\d{4,10}$/.test(code)) return false;
  if (canText()) {
    const result = await twilio("/VerificationCheck", { To: phone, Code: code });
    return result.status === "approved";
  }
  if (process.env.NODE_ENV === "production") throw new SmsNotSetUp("Text messages aren't set up");
  const saved = devCodes.get(phone);
  if (!saved || saved.expires < Date.now()) return false;
  const ok = saved.code.length === code.length && timingSafeEqual(Buffer.from(saved.code), Buffer.from(code));
  if (ok) devCodes.delete(phone);
  return ok;
}
