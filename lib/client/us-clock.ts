"use client";

import { useSyncExternalStore } from "react";

// US time zones, west to east. Abbreviations come from the browser, so they switch to PDT/CDT/EDT
// during daylight saving time.
export const US_ZONES = [
  { label: "Pacific", timeZone: "America/Los_Angeles" },
  { label: "Central", timeZone: "America/Chicago" },
  { label: "Eastern", timeZone: "America/New_York" },
] as const;

const formats = US_ZONES.map((zone) => ({
  time: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
  day: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, weekday: "short", month: "short", day: "numeric" }),
  abbr: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, timeZoneName: "short" }),
}));

export interface ZoneTime {
  label: string;
  abbr: string; // "PST" / "PDT"
  time: string; // "18:10:23"
  day: string; // "Tue, Nov 3"
}

/** The time in each US zone; placeholders when `date` is null (on the server, before hydration). */
export function zoneTimes(date: Date | null): ZoneTime[] {
  return US_ZONES.map((zone, i) => ({
    label: zone.label,
    abbr: date ? (formats[i].abbr.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "") : "",
    time: date ? formats[i].time.format(date) : "--:--:--",
    day: date ? formats[i].day.format(date) : "",
  }));
}

// One shared one-second timer for every clock on the page.
function subscribeToClock(onTick: () => void): () => void {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}
const nowInSeconds = () => Math.floor(Date.now() / 1000);
const noTimeOnServer = () => null;

/** The current time, updated every second; null on the server so the markup matches on hydration. */
export function useNow(): Date | null {
  const seconds = useSyncExternalStore(subscribeToClock, nowInSeconds, noTimeOnServer);
  return seconds === null ? null : new Date(seconds * 1000);
}
