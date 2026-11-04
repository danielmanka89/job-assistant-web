"use client";

import type { ClockTemplate } from "@/lib/types";
import { useCurrentUser } from "@/lib/client/current-user";
import { useNow, zoneTimes } from "@/lib/client/us-clock";

export const CLOCK_TEMPLATE_LABEL: Record<ClockTemplate, string> = { MINIMALIST: "Minimalist", NEON: "Neon", GLASS: "Glass" };

// mono-grayscale: the B&W theme drains the neon and glass colors instead of redrawing them.
const STYLES: Record<ClockTemplate, { box: string; cell: string; abbr: string; time: string }> = {
  MINIMALIST: {
    box: "divide-x divide-neutral-200 rounded-2xl border border-neutral-200/80 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60",
    cell: "px-1 py-2.5",
    abbr: "text-[10px] font-semibold tracking-widest text-neutral-400 dark:text-neutral-500",
    time: "font-display text-[15px] font-medium text-neutral-900 dark:text-white",
  },
  NEON: {
    box: "mono-grayscale gap-1 rounded-2xl border border-fuchsia-500/40 bg-neutral-950 p-1.5 shadow-[0_0_22px_rgba(217,70,239,0.25)]",
    cell: "rounded-xl bg-white/[0.03] px-1 py-2",
    abbr: "text-[10px] font-semibold tracking-widest text-fuchsia-300 [text-shadow:0_0_8px_rgba(232,121,249,0.8)]",
    time: "font-mono text-[14px] font-semibold text-cyan-300 [text-shadow:0_0_6px_rgba(103,232,249,0.9),0_0_16px_rgba(34,211,238,0.6)]",
  },
  GLASS: {
    box: "mono-grayscale gap-1 rounded-2xl bg-gradient-to-br from-orange-400/70 via-rose-500/60 to-brand-600/70 p-1.5 shadow-lg shadow-rose-500/20",
    cell: "rounded-xl border border-white/40 bg-white/25 px-1 py-2 backdrop-blur-md",
    abbr: "text-[10px] font-semibold tracking-widest text-white/85",
    time: "font-display text-[15px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
  },
};

/** Live Pacific / Central / Eastern clocks in one of the three templates. */
export function UsClocks({ template, className = "" }: { template: ClockTemplate; className?: string }) {
  const now = useNow();
  const style = STYLES[template];
  return (
    <ul aria-label="US time zones" className={`grid grid-cols-3 text-center ${style.box} ${className}`}>
      {zoneTimes(now).map((zone) => (
        <li key={zone.label} className={style.cell} title={zone.day ? `${zone.label} time · ${zone.day}` : undefined}>
          <p className={style.abbr}>{zone.abbr || zone.label.slice(0, 3).toUpperCase()}</p>
          <time dateTime={now?.toISOString()} className={`mt-0.5 block tabular-nums ${style.time}`}>
            {zone.time}
          </time>
        </li>
      ))}
    </ul>
  );
}

/** The clocks at the top of the dashboard sidebar, in the template chosen in Settings. */
export function SidebarClocks() {
  const user = useCurrentUser();
  // Users stored before templates existed have no clockTemplate yet.
  return <UsClocks template={user?.clockTemplate ?? "MINIMALIST"} />;
}
