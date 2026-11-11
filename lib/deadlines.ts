// The sidebar's deadline tracker: which Spreadsheet rows, learning paths and custom deadlines become
// items, and how the panel groups them. Shared by the API and the page (no server-only imports).
// Dates are "YYYY-MM-DD" strings, compared as calendar days so time zones can't shift them.

import type { DeadlineItem, LearningPath, Submission } from "@/lib/types";

/** Days after applying before a row with no reply gets a "Follow up" reminder. */
export const FOLLOW_UP_DAYS = 7;

// Statuses that mean the user is still waiting to hear back, and ones where the application is over.
const AWAITING_REPLY = new Set(["", "Applied", "Submitted to vendor", "Submitted to client"]);
const CLOSED = new Set(["Rejected", "Withdrawn", "Placed"]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Today's date on the viewer's own calendar. */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** How many jobs the user applied to today, this week (from Monday) and this month, on their own calendar. */
export function appliedCounts(rows: Submission[], now: Date): { today: number; week: number; month: number } {
  const today = localDate(now);
  const weekStart = addDays(today, -((now.getDay() + 6) % 7)); // Monday
  const monthStart = `${today.slice(0, 8)}01`;
  const counts = { today: 0, week: 0, month: 0 };
  for (const row of rows) {
    // The date typed on the Spreadsheet wins; otherwise the day the row was added.
    const typed = row.submission.submittedOn;
    const on = isDateString(typed) ? typed : localDate(new Date(row.createdAt));
    if (!isDateString(on) || on > today) continue;
    if (on === today) counts.today += 1;
    if (on >= weekStart) counts.week += 1;
    if (on >= monthStart) counts.month += 1;
  }
  return counts;
}

/** The tracker items for one Spreadsheet row: its interview, or a follow-up if it's still waiting for a reply. */
export function submissionDeadlines(row: Submission): DeadlineItem[] {
  const cells = row.submission;
  const status = (cells.status ?? "").trim();
  if (CLOSED.has(status)) return [];

  const company = row.client.clientCompany || row.client.endClient || row.vendor.vendorCompany || "";
  const job = cells.jobTitle || "Untitled job";
  const name = company || job;
  const role = [company ? job : "", cells.workMode].filter(Boolean).join(" · ");
  const href = "/dashboard/spreadsheet";

  if (isDateString(cells.interviewDate)) {
    return [{ id: `interview:${row.id}`, kind: "interview", title: `Interview · ${name}`, detail: role || "Interview", dueOn: cells.interviewDate, progress: null, done: false, href }];
  }
  if (!AWAITING_REPLY.has(status)) return [];
  const appliedOn = isDateString(cells.submittedOn) ? cells.submittedOn : row.createdAt.slice(0, 10);
  if (!isDateString(appliedOn)) return [];
  return [
    {
      id: `follow_up:${row.id}`,
      kind: "follow_up",
      title: `Follow up · ${name}`,
      detail: `Applied ${formatDay(appliedOn)}${role ? ` · ${role}` : ""}`,
      dueOn: addDays(appliedOn, FOLLOW_UP_DAYS),
      progress: null,
      done: false,
      href,
    },
  ];
}

/** A learning path the user has started and not finished, or null. */
export function learningDeadline(path: LearningPath): DeadlineItem | null {
  if (path.status !== "in_progress") return null;
  return { id: `learning:${path.id}`, kind: "learning", title: path.skillName, detail: "Learning path", dueOn: null, progress: path.progress, done: false, href: "/dashboard/learning" };
}

export function customDeadline(row: { id: string; title: string; dueOn: string; done: boolean }): DeadlineItem {
  return { id: `custom:${row.id}`, kind: "custom", title: row.title, detail: "My deadline", dueOn: row.dueOn, progress: null, done: row.done, href: null };
}

/** The custom deadline's database id from a tracker item id, or null for other kinds. */
export function customDeadlineId(itemId: string): string | null {
  return itemId.startsWith("custom:") ? itemId.slice("custom:".length) : null;
}

export type DeadlineGroup = "overdue" | "today" | "week" | "later" | "ongoing" | "done";

export const GROUP_LABEL: Record<DeadlineGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  ongoing: "In progress",
  done: "Done",
};

export function groupOf(item: DeadlineItem, today: string): DeadlineGroup {
  if (item.done) return "done";
  if (!item.dueOn) return "ongoing";
  const days = daysBetween(today, item.dueOn);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "week" : "later";
}

/**
 * The items worth showing today, soonest first: interviews that already happened drop out (the
 * status column is where the user records how it went), while late follow-ups and own deadlines stay.
 */
export function visibleDeadlines(items: DeadlineItem[], today: string): DeadlineItem[] {
  return items
    .filter((i) => !(i.kind === "interview" && i.dueOn && i.dueOn < today))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.title.localeCompare(b.title));
}

/** The soonest open item with a date (overdue ones first), for the corner widget. */
export function nextDeadline(visible: DeadlineItem[]): DeadlineItem | null {
  return visible.find((i) => !i.done && i.dueOn) ?? null;
}

/** Short relative label: "Today", "Tomorrow", "In 5 days", "2 days late". */
export function relativeDay(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1 day late";
  return days < 0 ? `${-days} days late` : `In ${days} days`;
}

/** "Thu 5 Nov". */
export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
