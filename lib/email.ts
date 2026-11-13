import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma, type EmailMessage as EmailRow, type User as UserRow } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EmailDetail, EmailSummary } from "@/lib/types";

// Project email (Inbox). Every account has an address at EMAIL_DOMAIN. Mail sent to it reaches
// POST /api/email/inbound through the email service (Resend) and is stored for that account alone;
// mail written in the Inbox is sent from the same address. Works with any other provider on the
// outside (Gmail, Outlook…): this is ordinary email.
//
// Environment:
//   EMAIL_DOMAIN           the domain of the addresses, e.g. "mail.example.com" or "<id>.resend.app"
//   RESEND_API_KEY         reads received emails and sends
//   RESEND_WEBHOOK_SECRET  the "whsec_…" signing secret of the email.received webhook
//   EMAIL_SENDING          "true" once the domain is verified for sending in Resend

const RESEND_API = process.env.RESEND_API_URL || "https://api.resend.com";

/** The address domain, lowercased, or null while email isn't set up on this server. */
export function emailDomain(): string | null {
  const domain = process.env.EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  return domain || null;
}

export const canReceive = () => Boolean(emailDomain() && process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET);
export const canSend = () => Boolean(emailDomain() && process.env.RESEND_API_KEY && process.env.EMAIL_SENDING === "true");

/* ---------- Addresses ---------- */

const SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)

/** "Daniel L. Manka" -> "daniel.manka": first and last word of the name, letters and digits only. */
function nameSlug(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.join(".").slice(0, 30) || "user";
}

/**
 * The account's address name, made the first time it's needed. A random ending keeps addresses from
 * being guessed from a person's name and lets two people with the same name each have one.
 */
export async function ensureMailboxName(user: Pick<UserRow, "id" | "name" | "mailboxName">): Promise<string> {
  if (user.mailboxName) return user.mailboxName;
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 4 }, () => SUFFIX_CHARS[randomInt(SUFFIX_CHARS.length)]).join("");
    const mailboxName = `${nameSlug(user.name)}.${suffix}`;
    try {
      // Only fills an empty name, so two requests at once end up with the same one.
      await prisma.user.updateMany({ where: { id: user.id, mailboxName: null }, data: { mailboxName } });
      const saved = await prisma.user.findUnique({ where: { id: user.id }, select: { mailboxName: true } });
      if (saved?.mailboxName) return saved.mailboxName;
    } catch (error) {
      // P2002: someone else already has this name; try another ending.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new Error("could not create a mailbox name");
}

/** Splits `Name <a@b.c>` or a bare address into its parts; the address is lowercased. */
export function parseAddress(value: string): { name: string; address: string } {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(value);
  const address = (match ? match[2] : value).trim().toLowerCase();
  const name = match ? match[1].replace(/^"(.*)"$/, "$1").trim() : "";
  return { name, address };
}

const ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]+$/;
export const isEmailAddress = (value: string) => value.length <= 254 && ADDRESS.test(value);

/** The address name, if `address` is one of this server's project addresses. */
export function mailboxNameOf(address: string): string | null {
  const domain = emailDomain();
  const at = address.lastIndexOf("@");
  if (!domain || at < 1 || address.slice(at + 1).toLowerCase() !== domain) return null;
  return address.slice(0, at).toLowerCase();
}

/* ---------- Text ---------- */

export const MAX_STORED_BODY_CHARS = 100_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A readable plain-text version of an HTML email. Nothing from the HTML is ever shown as HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => safeCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole: string, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeCodePoint(n: number): string {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

/* ---------- Email service (Resend) ---------- */

/**
 * Checks that a webhook really came from the email service: an HMAC-SHA256 of
 * "<id>.<timestamp>.<raw body>" with the signing secret, sent in the svix-signature header.
 */
export function verifyWebhook(rawBody: string, headers: Headers, now = Date.now()): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;

  // Old deliveries can't be replayed: five minutes either side of now.
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((entry) => {
    const given = Buffer.from(entry.slice(entry.indexOf(",") + 1), "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export class EmailServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function resend(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";
    throw new EmailServiceError(message || `email service answered ${response.status}`, response.status);
  }
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" ? [value] : []);

/** The parts of a received email we keep. The webhook carries no body, so it's read from the service. */
export async function fetchReceivedEmail(providerId: string) {
  const email = await resend(`/emails/receiving/${encodeURIComponent(providerId)}`);
  const plain = text(email.text).trim();
  const body = (plain || htmlToText(text(email.html))).slice(0, MAX_STORED_BODY_CHARS);
  const attachments = Array.isArray(email.attachments)
    ? email.attachments.map((a) => text((a as { filename?: unknown } | null)?.filename)).filter(Boolean).slice(0, 50)
    : [];
  // "received_for" is who the mail was actually delivered to; the To/Cc headers are only what the
  // sender wrote, so they're used just when the service gives no delivery list.
  const deliveredTo = list(email.received_for);
  const recipients = deliveredTo.length ? deliveredTo : [...list(email.to), ...list(email.cc), ...list(email.bcc)];
  return {
    from: parseAddress(text(email.from)),
    recipients: recipients.map((r) => parseAddress(r).address),
    subject: text(email.subject).slice(0, 500),
    body,
    attachments,
    messageId: text(email.message_id) || null,
  };
}

/** Sends an email from a project address and returns the service's id for it. */
export async function sendEmail(input: {
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  idempotencyKey: string;
}): Promise<string | null> {
  // The display name goes in quotes, so drop the characters that would end them.
  const name = input.fromName.replace(/["\\\r\n<>]/g, "").trim();
  const result = await resend("/emails", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      from: name ? `"${name}" <${input.fromAddress}>` : input.fromAddress,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      ...(input.inReplyTo ? { headers: { "In-Reply-To": input.inReplyTo, References: input.inReplyTo } } : {}),
    }),
  });
  return text(result.id) || null;
}

/* ---------- API shapes ---------- */

const PREVIEW_CHARS = 140;

/** The start of a body on one line, stored with the email for the list. */
export const previewOf = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

export function toEmailSummary(row: Omit<EmailRow, "body">): EmailSummary {
  return {
    id: row.id,
    direction: row.direction === "out" ? "out" : "in",
    fromAddress: row.fromAddress,
    fromName: row.fromName,
    toAddress: row.toAddress,
    subject: row.subject,
    preview: row.preview,
    unread: row.direction === "in" && !row.readAt,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toEmailDetail(row: EmailRow): EmailDetail {
  return {
    ...toEmailSummary(row),
    body: row.body,
    attachments: Array.isArray(row.attachments) ? row.attachments.filter((a): a is string => typeof a === "string") : [],
  };
}
