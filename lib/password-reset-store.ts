import { prisma } from "@/lib/db";
import { hashSecret } from "@/lib/password-reset";

/** The open (unexpired, unused) reset behind a token, with its account. */
export async function findOpenReset(token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashSecret(token, "reset-token") },
    include: { user: { select: { id: true, email: true, name: true, phone: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return null;
  return reset;
}
