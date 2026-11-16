import { passwordError } from "@/lib/account-validation";
import { apiError, readJsonObject } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { sendPasswordChangedEmail } from "@/lib/password-reset";
import { findOpenReset } from "@/lib/password-reset-store";

/**
 * POST /api/auth/reset/complete { token, password } — the last step: sets the new password, only
 * once the emailed code and (for accounts with a phone) the texted code were both right. Every
 * session is signed out, and the account gets a "your password was changed" email.
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const password = typeof body.password === "string" ? body.password : "";

  const reset = await findOpenReset(body.token);
  const verified = reset && reset.emailVerifiedAt && (!reset.user.phone || reset.phoneVerifiedAt);
  if (!reset || !verified) return apiError(400, "RESET_EXPIRED", "This reset has expired. Please start again.");

  const error = passwordError(password);
  if (error) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { password: error });

  const { user } = reset;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), ...(reset.phoneVerifiedAt ? { phoneVerifiedAt: reset.phoneVerifiedAt } : {}) },
    }),
    // Used, along with any other open resets for the account.
    prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await sendPasswordChangedEmail(user.email, user.name, `reset-done-${reset.id}`).catch((e) => console.error("password-changed email failed", e));
  return new Response(null, { status: 204 });
}
