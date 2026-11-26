"use client";

import type { ThemeColor, ClockTemplate } from "@/lib/types";
import { useCurrentUser } from "@/lib/client/current-user";
import { useNow, zoneTimes } from "@/lib/client/us-clock";

export const CLOCK_TEMPLATE_LABEL: Record<ClockTemplate, string> = { MINIMALIST: "Minimalist", NEON: "Neon", GLASS: "Glass" };
export const THEME_COLOR_LABEL: Record<ThemeColor, string> = { NAVY: "Midnight Navy", TEAL: "Deep Teal", PLUM: "Dusky Plum", GRAPHITE: "Gray Glass" };

type ClockStyle = { box: string; cell: string; abbr: string; time: string };

// Every template is drawn in the brand-* colors, which follow the theme (data-accent), so one style
// per template covers all three themes.
// mono-grayscale: the B&W theme drains the neon and glass colors instead of redrawing them.
const STYLES: Record<ClockTemplate, ClockStyle> = {
  MINIMALIST: {
    box: "divide-x divide-neutral-200/70 rounded-2xl bg-white dark:divide-neutral-800 dark:bg-neutral-900/60",
    cell: "px-1 py-2.5",
    abbr: "text-[10px] font-semibold tracking-widest text-brand-600 dark:text-brand-300",
    time: "font-display text-[15px] font-medium text-neutral-900 dark:text-white",
  },
  NEON: {
    box: "mono-grayscale gap-1 rounded-2xl border border-brand-400/50 bg-brand-950 p-1.5 shadow-[0_0_22px_rgb(var(--brand-glow)/0.35)]",
    cell: "rounded-xl bg-brand-400/[0.06] px-1 py-2",
    abbr: "text-[10px] font-semibold tracking-widest text-brand-200 [text-shadow:0_0_8px_rgb(var(--brand-glow)/0.85)]",
    time: "font-mono text-[14px] font-semibold text-brand-100 [text-shadow:0_0_6px_rgb(var(--brand-glow)/0.95),0_0_16px_rgb(var(--brand-glow)/0.75)]",
  },
  GLASS: {
    // Darker stops, so the small white text stays readable.
    box: "mono-grayscale gap-1 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-1.5 shadow-lg shadow-brand-900/30",
    cell: "rounded-xl border border-white/30 bg-black/10 px-1 py-2 backdrop-blur-md",
    abbr: "text-[10px] font-semibold tracking-widest text-white",
    time: "font-display text-[15px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
  },
};

/** Live Pacific / Central / Eastern clocks in one of the three templates, in the current theme color. */
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

/** The clocks at the top of the dashboard sidebar, in the template chosen in Settings (and the theme color). */
export function SidebarClocks() {
  const user = useCurrentUser();
  // Compact in the sidebar: smaller time and zone labels, tighter cells.
  return <UsClocks template={user?.clockTemplate ?? "MINIMALIST"} className="[&_li]:py-1.5 [&_p]:text-[9px] [&_time]:text-[13px]" />;
}
