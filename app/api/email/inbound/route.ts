import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canReceive, fetchReceivedEmail, mailboxNameOf, parseAddress, previewOf, verifyWebhook } from "@/lib/email";

/**
 * POST /api/email/inbound — the email service's "email.received" webhook. Not called by the app:
 * the request is trusted only if its signature matches RESEND_WEBHOOK_SECRET.
 *
 * Stores the email for every account whose project address it was sent to. Mail for an address
 * nobody has is dropped. Any answer other than 2xx makes the service deliver it again later.
 */
export async function POST(request: Request) {
  if (!canReceive()) return apiError(503, "EMAIL_NOT_CONFIGURED", "Receiving email isn't set up on this server yet.");

  // The signature covers the exact bytes sent, so read the body as text before parsing it.
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers)) return apiError(401, "INVALID_SIGNATURE", "Webhook signature didn't match");

  let event: { type?: unknown; data?: Record<string, unknown> | null };
  try {
    event = JSON.parse(raw);
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be JSON");
  }
  const providerId = event?.data?.email_id;
  if (event?.type !== "email.received" || typeof providerId !== "string" || !providerId) return NextResponse.json({ stored: 0 });

  let email: Awaited<ReturnType<typeof fetchReceivedEmail>>;
  try {
    email = await fetchReceivedEmail(providerId);
  } catch (error) {
    console.error("inbound email: could not read", providerId, error);
    return apiError(502, "EMAIL_SERVICE_UNAVAILABLE", "Could not read the email from the email service");
  }

  // Who it was delivered to, from the email itself; the webhook's own list is the fallback.
  const data = event.data ?? {};
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const fromWebhook = (strings(data.received_for).length ? strings(data.received_for) : [...strings(data.to), ...strings(data.cc), ...strings(data.bcc)]).map((r) => parseAddress(r).address);
  const addresses = [...new Set(email.recipients.length ? email.recipients : fromWebhook)];
  const names = addresses.map(mailboxNameOf).filter((n): n is string => n !== null);
  if (!names.length) return NextResponse.json({ stored: 0 });

  const users = await prisma.user.findMany({ where: { mailboxName: { in: names } }, select: { id: true, mailboxName: true } });
  let stored = 0;
  for (const user of users) {
    try {
      await prisma.emailMessage.create({
        data: {
          userId: user.id,
          direction: "in",
          providerId,
          fromAddress: email.from.address,
          fromName: email.from.name,
          toAddress: addresses.find((a) => mailboxNameOf(a) === user.mailboxName) ?? "",
          subject: email.subject || "(no subject)",
          body: email.body,
          preview: previewOf(email.body),
          attachments: email.attachments,
          messageId: email.messageId,
        },
      });
      stored++;
    } catch (error) {
      // P2002: this delivery was already stored for this account (the service retried).
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  return NextResponse.json({ stored });
}
