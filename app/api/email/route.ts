import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmailServiceError, canReceive, canSend, emailDomain, ensureMailboxName, isEmailAddress, previewOf, sendEmail, toEmailDetail, toEmailSummary } from "@/lib/email";
import {
  MAX_EMAILS_PER_DAY,
  MAX_EMAIL_BODY_CHARS,
  MAX_EMAIL_SUBJECT_CHARS,
  type EmailDetail,
  type EmailListResponse,
} from "@/lib/types";

const PAGE = 200; // most recent emails shown

/** GET /api/email — your project address and your emails (received and sent), newest first. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your inbox");

  const domain = emailDomain();
  const [mailboxName, rows] = await Promise.all([
    domain ? ensureMailboxName(user) : null,
    prisma.emailMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: PAGE, omit: { body: true } }),
  ]);

  return NextResponse.json<EmailListResponse>({
    address: mailboxName && domain ? `${mailboxName}@${domain}` : null,
    canReceive: canReceive(),
    canSend: canSend(),
    emails: rows.map(toEmailSummary),
  });
}

/** POST /api/email { to, subject, body, replyToId? } — sends an email from your project address. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to send email");

  const domain = emailDomain();
  if (!domain || !canSend()) return apiError(503, "EMAIL_NOT_CONFIGURED", "Sending email isn't set up on this server yet.");

  const json = await readJsonObject(request);
  if (!json) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const to = typeof json.to === "string" ? json.to.trim().toLowerCase() : "";
  const subject = typeof json.subject === "string" ? json.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const body = typeof json.body === "string" ? json.body.trim() : "";
  const replyToId = typeof json.replyToId === "string" && json.replyToId.length <= 100 ? json.replyToId : null;

  const fieldErrors: Record<string, string> = {};
  if (!to) fieldErrors.to = "Enter who to send it to";
  else if (!isEmailAddress(to)) fieldErrors.to = "Enter one email address, like name@example.com";
  if (!subject) fieldErrors.subject = "Add a subject";
  else if (subject.length > MAX_EMAIL_SUBJECT_CHARS) fieldErrors.subject = `Subjects can be at most ${MAX_EMAIL_SUBJECT_CHARS} characters`;
  if (!body) fieldErrors.body = "Write a message first";
  else if (body.length > MAX_EMAIL_BODY_CHARS) fieldErrors.body = `Emails can be at most ${MAX_EMAIL_BODY_CHARS.toLocaleString("en-US")} characters`;
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  // A daily limit per account, so one account can't use the site to send bulk mail.
  const sentToday = await prisma.emailMessage.count({
    where: { userId: user.id, direction: "out", createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (sentToday >= MAX_EMAILS_PER_DAY) {
    return apiError(429, "EMAIL_LIMIT_REACHED", `You can send up to ${MAX_EMAILS_PER_DAY} emails a day. Try again tomorrow.`);
  }

  const original = replyToId
    ? await prisma.emailMessage.findFirst({ where: { id: replyToId, userId: user.id, direction: "in" }, select: { messageId: true } })
    : null;
  const fromAddress = `${await ensureMailboxName(user)}@${domain}`;

  // Saved first, so the id can stop a retried request from sending the same email twice.
  const row = await prisma.emailMessage.create({
    data: { userId: user.id, direction: "out", fromAddress, fromName: user.name, toAddress: to, subject, body, preview: previewOf(body), readAt: new Date() },
  });
  try {
    const providerId = await sendEmail({ fromName: user.name, fromAddress, to, subject, body, inReplyTo: original?.messageId, idempotencyKey: `email-${row.id}` });
    const saved = providerId ? await prisma.emailMessage.update({ where: { id: row.id }, data: { providerId } }) : row;
    return NextResponse.json<EmailDetail>(toEmailDetail(saved), { status: 201 });
  } catch (error) {
    await prisma.emailMessage.delete({ where: { id: row.id } }).catch(() => undefined);
    console.error("send email failed", error instanceof EmailServiceError ? `${error.status} ${error.message}` : error);
    return apiError(502, "EMAIL_SEND_FAILED", "The email couldn't be sent. Please try again.");
  }
}
