"use client";

import type { User } from "@/lib/types";
import { speak } from "@/lib/client/speech";

export type DayPart = "morning" | "noon" | "afternoon" | "evening" | "night";

/** The part of the day for a local time: noon is the 12 o'clock hour, night runs 9 pm to 5 am. */
export function dayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour === 12) return "noon";
  if (hour > 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** The spoken welcome for a candidate, matched to the candidate's local time of day. */
export function greetingText(name: string, date: Date): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const who = first ? `, ${first}` : "";
  switch (dayPart(date)) {
    case "morning":
      return `Good morning${who}! Wishing you the best of luck applying for jobs today.`;
    case "noon":
      return `Good noon${who}! Hope your day is going well. Good luck applying for jobs this afternoon.`;
    case "afternoon":
      return `Good afternoon${who}! Wishing you the best of luck applying for jobs today.`;
    case "evening":
      return `Good evening${who}! Good luck applying for jobs this evening.`;
    case "night":
      return `Hello${who}, thanks for putting in the late-night effort! Good luck applying for jobs tonight.`;
  }
}

/** Says the welcome out loud. Call it straight from the sign-in submit handler. Employers aren't greeted. */
export function speakLoginGreeting(user: User): void {
  if (user.role !== "SEEKER") return;
  speak(greetingText(user.name, new Date()));
}
