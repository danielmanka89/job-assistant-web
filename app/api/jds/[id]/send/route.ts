import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmailServiceError, canSend, emailDomain, ensureMailboxName, isEmailAddress, previewOf, sendEmail } from "@/lib/email";
import { jobTypesOf } from "@/lib/job-types";
import { getProfileValues } from "@/lib/profile-store";
import { prefillSubmission } from "@/lib/spreadsheet";
import { toVendorJds } from "@/lib/vendor-jds";
import { MAX_EMAILS_PER_DAY, MAX_EMAIL_BODY_CHARS, MAX_EMAIL_SUBJECT_CHARS, type VendorJd } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const MAX_SUBMISSIONS = 2000; // same cap as POST /api/submissions

/**
 * POST /api/jds/:id/send — your resume is going to the vendor.
 * { mode: "email", to, subject, body, fileIds } sends it from your site address with the tailored files attached;
 * { mode: "mark", to? } only records that you sent it yourself. Either way the JD is marked as sent and,
 * the first time, a Spreadsheet row is added with status "Submitted to vendor".
 */
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to send your resume");
  const { id } = await params;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const mode = body.mode;
  if (mode !== "email" && mode !== "mark") {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { mode: 'Use "email" or "mark"' });
  }

  const row = await prisma.vendorJd.findFirst({ where: { id, userId: user.id } });
  if (!row) return apiError(404, "JD_NOT_FOUND", "That JD isn't saved anymore");

  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : row.vendorEmail;
  if (to && !isEmailAddress(to)) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { to: "Enter one email address, like name@example.com" });
  }

  if (mode === "email") {
    const domain = emailDomain();
    if (!domain || !canSend()) return apiError(503, "EMAIL_NOT_CONFIGURED", "Sending email isn't set up on this server yet.");

    const subject = typeof body.subject === "string" ? body.subject.replace(/[\r\n]+/g, " ").trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const fileIds = Array.isArray(body.fileIds) ? [...new Set(body.fileIds.filter((f): f is string => typeof f === "string"))] : [];
    const fieldErrors: Record<string, string> = {};
    if (!to) fieldErrors.to = "Enter the vendor's email address";
    if (!subject) fieldErrors.subject = "Add a subject";
    else if (subject.length > MAX_EMAIL_SUBJECT_CHARS) fieldErrors.subject = `Subjects can be at most ${MAX_EMAIL_SUBJECT_CHARS} characters`;
    if (!text) fieldErrors.body = "Write a message first";
    else if (text.length > MAX_EMAIL_BODY_CHARS) fieldErrors.body = `Emails can be at most ${MAX_EMAIL_BODY_CHARS.toLocaleString("en-US")} characters`;
    if (!fileIds.length) fieldErrors.fileIds = "Attach your resume";
    if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

    // Only the files of this JD's own tailored resume can be attached.
    const [jd] = await toVendorJds(user.id, [row]);
    const allowed = new Set(jd.tailored?.files.map((f) => f.id) ?? []);
    if (fileIds.some((f) => !allowed.has(f))) {
      return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { fileIds: "Tailor your resume for this JD first" });
    }
    const files = await prisma.generatedFile.findMany({ where: { id: { in: fileIds }, userId: user.id }, select: { fileName: true, data: true } });
    if (files.length !== fileIds.length || files.some((f) => !f.data)) {
      return apiError(409, "FILE_MISSING", "Your resume file isn't available anymore. Tailor it again.");
    }

    const fromAddress = `${await ensureMailboxName(user)}@${domain}`;
    const email = await prisma.emailMessage.create({
      data: {
        userId: user.id,
        direction: "out",
        fromAddress,
        fromName: user.name,
        toAddress: to,
        subject,
        body: text,
        preview: previewOf(text),
        attachments: files.map((f) => f.fileName),
        readAt: new Date(),
      },
    });
    // The same daily limit as the Inbox (see POST /api/email).
    const sentToday = await prisma.emailMessage.count({
      where: { userId: user.id, direction: "out", createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (sentToday > MAX_EMAILS_PER_DAY) {
      await prisma.emailMessage.delete({ where: { id: email.id } }).catch(() => undefined);
      return apiError(429, "EMAIL_LIMIT_REACHED", `You can send up to ${MAX_EMAILS_PER_DAY} emails a day. Try again tomorrow.`);
    }
    try {
      const providerId = await sendEmail({
        fromName: user.name,
        fromAddress,
        to,
        subject,
        body: text,
        idempotencyKey: `email-${email.id}`,
        attachments: files.map((f) => ({ fileName: f.fileName, data: f.data! })),
      });
      if (providerId) await prisma.emailMessage.update({ where: { id: email.id }, data: { providerId } });
    } catch (error) {
      await prisma.emailMessage.delete({ where: { id: email.id } }).catch(() => undefined);
      console.error("send resume to vendor failed", error instanceof EmailServiceError ? `${error.status} ${error.message}` : error);
      return apiError(502, "EMAIL_SEND_FAILED", "The email couldn't be sent. Please try again.");
    }
  }

  const submissionId = row.submissionId ?? (await addSpreadsheetRow(user.id, row));
  const saved = await prisma.vendorJd.update({ where: { id: row.id }, data: { sentAt: new Date(), sentTo: to, submissionId } });
  const [jd] = await toVendorJds(user.id, [saved]);
  return NextResponse.json<VendorJd>(jd);
}

/** A Spreadsheet row for the JD, filled in like an Apply from the job board. Null when the sheet is full. */
async function addSpreadsheetRow(userId: string, jd: NonNullable<Awaited<ReturnType<typeof prisma.vendorJd.findFirst>>>) {
  if ((await prisma.submission.count({ where: { userId } })) >= MAX_SUBMISSIONS) return null;
  const [resume, analysis, profile] = await Promise.all([
    prisma.resume.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.gapAnalysis.findFirst({
      where: { userId, jobDescription: jd.jobDescription.trim() },
      orderBy: { createdAt: "desc" },
      select: { matchedKeywords: true, missingKeywords: true },
    }),
    getProfileValues(userId),
  ]);
  const cells = prefillSubmission(
    {
      title: jd.title,
      company: jd.client,
      location: jd.location,
      description: jd.jobDescription,
      applyUrl: "",
      employmentTypes: jobTypesOf([], jd.jobDescription),
    },
    resume ? toResume(resume) : null,
    analysis ? { matchedKeywords: analysis.matchedKeywords as string[], missingKeywords: analysis.missingKeywords as string[] } : null,
    profile,
  );
  const keep = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([, v]) => v));
  const row = await prisma.submission.create({
    data: {
      userId,
      jobPostingId: null,
      vendor: keep({ vendorCompany: jd.vendorCompany, contactName: jd.vendorContact, contactEmail: jd.vendorEmail, vendorRate: jd.rate }),
      submission: keep({ ...cells.submission, status: "Submitted to vendor", rate: jd.rate || (cells.submission.rate ?? "") }),
      skills: cells.skills,
      client: keep({ clientCompany: jd.client, clientLocation: jd.location }),
    },
  });
  return row.id;
}
