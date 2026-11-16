import { NextResponse } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { prisma } from "@/lib/db";
import { MAX_CODE_ATTEMPTS, codeMatches } from "@/lib/password-reset";
import { findOpenReset } from "@/lib/password-reset-store";
import { maskPhone } from "@/lib/phone";
import { SmsNotSetUp, sendPhoneCode } from "@/lib/sms";
import type { ResetStepResponse } from "@/lib/types";

const WRONG = "That code isn't right, or it has expired. Check the newest email, or start again.";

/**
 * POST /api/auth/reset/email { token, code } — step 2: checks the emailed code, then texts a second
 * code to the account's phone. Accounts with no phone go straight to choosing a password.
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";

  const reset = await findOpenReset(body.token);
  if (!reset || reset.emailAttempts >= MAX_CODE_ATTEMPTS) return apiError(400, "VALIDATION_ERROR", WRONG, { code: WRONG });

  if (!reset.emailVerifiedAt) {
    if (!codeMatches(code, reset.emailCodeHash, "reset-email")) {
      await prisma.passwordReset.update({ where: { id: reset.id }, data: { emailAttempts: { increment: 1 } } });
      return apiError(400, "VALIDATION_ERROR", WRONG, { code: WRONG });
    }
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { emailVerifiedAt: new Date() } });
  }

  const phone = reset.user.phone;
  if (!phone) return NextResponse.json<ResetStepResponse>({ next: "password" });
  try {
    await sendPhoneCode(phone);
  } catch (e) {
    if (e instanceof SmsNotSetUp) return apiError(503, "RESET_NOT_SET_UP", "Text messages aren't switched on yet, so passwords can't be reset. Please contact the site owner.");
    console.error("reset SMS failed", e);
    return apiError(502, "SMS_FAILED", "We couldn't text your phone just now. Please try again in a minute.");
  }
  return NextResponse.json<ResetStepResponse>({ next: "phone", phoneHint: maskPhone(phone) });
}
