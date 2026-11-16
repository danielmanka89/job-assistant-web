import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { hashSecret } from "@/lib/password-reset";
import { normalizePhone, phoneError } from "@/lib/phone";
import { SmsNotSetUp, checkPhoneCode, sendPhoneCode } from "@/lib/sms";
import type { AccountResponse } from "@/lib/types";

const TICKET_MINUTES = 10;

/**
 * Ties step 2 to step 1: a code can only save the number this account asked for, after its password
 * was checked. (Otherwise a stolen login could save a number verified from some other account.)
 */
function ticketFor(userId: string, phone: string, expires: number) {
  return `${expires}.${hashSecret(`${userId}:${phone}:${expires}`, "phone-change")}`;
}
function ticketValid(ticket: unknown, userId: string, phone: string) {
  if (typeof ticket !== "string") return false;
  const expires = Number(ticket.split(".")[0]);
  return Number.isFinite(expires) && expires > Date.now() && ticket === ticketFor(userId, phone, expires);
}

function smsFailure(e: unknown) {
  if (e instanceof SmsNotSetUp) return apiError(503, "SMS_NOT_SET_UP", "Text messages aren't switched on yet, so phone numbers can't be changed right now.");
  console.error("phone SMS failed", e);
  return apiError(502, "SMS_FAILED", "We couldn't text that number just now. Please try again in a minute.");
}

/**
 * POST /api/account/phone { phone, currentPassword } — step 1 of adding or changing your mobile
 * number: checks your password, texts a code to the new number, and answers { ticket } for step 2.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your phone number");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const input = typeof body.phone === "string" ? body.phone : "";
  const fieldErrors: Record<string, string> = {};
  const error = phoneError(input);
  if (error) fieldErrors.phone = error;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  if (!currentPassword) fieldErrors.currentPassword = "Enter your current password";
  else if (!(await verifyPassword(currentPassword, user.passwordHash))) fieldErrors.currentPassword = "That password isn't right";
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  const phone = normalizePhone(input)!;
  try {
    await sendPhoneCode(phone);
  } catch (e) {
    return smsFailure(e);
  }
  return NextResponse.json({ ticket: ticketFor(user.id, phone, Date.now() + TICKET_MINUTES * 60_000) });
}

/** PUT /api/account/phone { phone, code, ticket } — step 2: the texted code is right, so the number is saved. */
export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your phone number");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  const wrong = "That code isn't right, or it has expired.";
  if (!phone) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { phone: "Enter your mobile number with its country code" });
  if (!ticketValid(body.ticket, user.id, phone)) return apiError(400, "PHONE_CHANGE_EXPIRED", "This took too long. Please send a new code.");

  let ok: boolean;
  try {
    ok = await checkPhoneCode(phone, code);
  } catch (e) {
    return smsFailure(e);
  }
  if (!ok) return apiError(400, "VALIDATION_ERROR", wrong, { code: wrong });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: new Date() } });
  return NextResponse.json<AccountResponse>({ user: toUser(updated) });
}
