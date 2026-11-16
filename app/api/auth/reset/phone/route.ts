import { NextResponse } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { prisma } from "@/lib/db";
import { MAX_CODE_ATTEMPTS } from "@/lib/password-reset";
import { findOpenReset } from "@/lib/password-reset-store";
import { SmsNotSetUp, checkPhoneCode } from "@/lib/sms";
import type { ResetStepResponse } from "@/lib/types";

const WRONG = "That code isn't right, or it has expired. Check the newest text, or start again.";

/** POST /api/auth/reset/phone { token, code } — step 3: checks the texted code. */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";

  const reset = await findOpenReset(body.token);
  const phone = reset?.user.phone;
  if (!reset || !reset.emailVerifiedAt || !phone || reset.phoneAttempts >= MAX_CODE_ATTEMPTS) return apiError(400, "VALIDATION_ERROR", WRONG, { code: WRONG });
  if (reset.phoneVerifiedAt) return NextResponse.json<ResetStepResponse>({ next: "password" });

  let ok: boolean;
  try {
    ok = await checkPhoneCode(phone, code);
  } catch (e) {
    if (e instanceof SmsNotSetUp) return apiError(503, "RESET_NOT_SET_UP", "Text messages aren't switched on yet. Please contact the site owner.");
    console.error("reset SMS check failed", e);
    return apiError(502, "SMS_FAILED", "We couldn't check the code just now. Please try again in a minute.");
  }
  if (!ok) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { phoneAttempts: { increment: 1 } } });
    return apiError(400, "VALIDATION_ERROR", WRONG, { code: WRONG });
  }
  await prisma.passwordReset.update({ where: { id: reset.id }, data: { phoneVerifiedAt: new Date() } });
  return NextResponse.json<ResetStepResponse>({ next: "password" });
}
