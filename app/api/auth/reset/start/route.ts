import { NextResponse } from "next/server";
import { emailError, normalizeEmail } from "@/lib/account-validation";
import { apiError, readJsonObject } from "@/lib/api";
import { prisma } from "@/lib/db";
import { EmailNotSetUp, MAX_RESETS_PER_HOUR, RESET_MINUTES, clientIp, hashSecret, newCode, newResetToken, sendResetCodeEmail, tooManyFromIp } from "@/lib/password-reset";
import type { ResetStartResponse } from "@/lib/types";

/**
 * POST /api/auth/reset/start { email } — step 1 of Forgot password: emails a 6-digit code. Answers the
 * same way whether or not the email has an account, so it can't be used to find out who's signed up.
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const error = emailError(email);
  if (error) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { email: error });
  if (tooManyFromIp(clientIp(request))) return apiError(429, "TOO_MANY_REQUESTS", "Too many tries. Please wait 15 minutes and try again.");

  const token = newResetToken();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (user) {
    const lastHour = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (lastHour >= MAX_RESETS_PER_HOUR) return apiError(429, "TOO_MANY_REQUESTS", "Too many reset emails for this account. Please wait an hour and try again.");

    const code = newCode();
    const reset = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(token, "reset-token"),
        emailCodeHash: hashSecret(code, "reset-email"),
        expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
      },
    });
    try {
      await sendResetCodeEmail(user.email, user.name, code, `reset-${reset.id}`);
    } catch (e) {
      await prisma.passwordReset.delete({ where: { id: reset.id } }).catch(() => undefined);
      if (e instanceof EmailNotSetUp) return apiError(503, "RESET_NOT_SET_UP", "Password reset isn't switched on yet. Please contact the site owner.");
      console.error("reset email failed", e);
      return apiError(502, "EMAIL_FAILED", "We couldn't send the email just now. Please try again in a minute.");
    }
  }
  return NextResponse.json<ResetStartResponse>({ token });
}
