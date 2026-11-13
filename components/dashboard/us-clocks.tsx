"use client";

import type { ThemeColor, ClockTemplate } from "@/lib/types";
import { useCurrentUser } from "@/lib/client/current-user";
import { useNow, zoneTimes } from "@/lib/client/us-clock";

export const CLOCK_TEMPLATE_LABEL: Record<ClockTemplate, string> = { MINIMALIST: "Minimalist", NEON: "Neon", GLASS: "Glass" };
export const THEME_COLOR_LABEL: Record<ThemeColor, string> = { BLUE: "Blue", GREEN: "Green", RED: "Red" };

type ClockStyle = { box: string; cell: string; abbr: string; time: string };

// Full class names per color (Tailwind only ships classes it can see written out).
// mono-grayscale: the B&W theme drains the neon and glass colors instead of redrawing them.
const STYLES: Record<ClockTemplate, Record<ThemeColor, ClockStyle>> = {
  MINIMALIST: (() => {
    const base = {
      box: "divide-x divide-neutral-200 rounded-2xl border border-neutral-200/80 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60",
      cell: "px-1 py-2.5",
      time: "font-display text-[15px] font-medium text-neutral-900 dark:text-white",
    };
    const abbr = "text-[10px] font-semibold tracking-widest";
    return {
      BLUE: { ...base, abbr: `${abbr} text-blue-700 dark:text-blue-400` },
      GREEN: { ...base, abbr: `${abbr} text-emerald-700 dark:text-emerald-400` },
      RED: { ...base, abbr: `${abbr} text-brand-600 dark:text-brand-400` },
    };
  })(),
  NEON: {
    // Navy panel with electric-blue tubes.
    BLUE: {
      box: "mono-grayscale gap-1 rounded-2xl border border-blue-500/50 bg-[#050a24] p-1.5 shadow-[0_0_22px_rgba(59,130,246,0.35)]",
      cell: "rounded-xl bg-blue-400/[0.05] px-1 py-2",
      abbr: "text-[10px] font-semibold tracking-widest text-sky-300 [text-shadow:0_0_8px_rgba(125,211,252,0.85)]",
      time: "font-mono text-[14px] font-semibold text-blue-300 [text-shadow:0_0_6px_rgba(147,197,253,0.95),0_0_16px_rgba(59,130,246,0.75)]",
    },
    GREEN: {
      box: "mono-grayscale gap-1 rounded-2xl border border-emerald-500/50 bg-[#03140c] p-1.5 shadow-[0_0_22px_rgba(16,185,129,0.3)]",
      cell: "rounded-xl bg-emerald-400/[0.05] px-1 py-2",
      abbr: "text-[10px] font-semibold tracking-widest text-lime-300 [text-shadow:0_0_8px_rgba(190,242,100,0.8)]",
      time: "font-mono text-[14px] font-semibold text-emerald-300 [text-shadow:0_0_6px_rgba(110,231,183,0.95),0_0_16px_rgba(16,185,129,0.7)]",
    },
    RED: {
      box: "mono-grayscale gap-1 rounded-2xl border border-rose-500/50 bg-[#1a0508] p-1.5 shadow-[0_0_22px_rgba(244,63,94,0.3)]",
      cell: "rounded-xl bg-rose-400/[0.05] px-1 py-2",
      abbr: "text-[10px] font-semibold tracking-widest text-orange-300 [text-shadow:0_0_8px_rgba(253,186,116,0.8)]",
      time: "font-mono text-[14px] font-semibold text-rose-300 [text-shadow:0_0_6px_rgba(253,164,175,0.95),0_0_16px_rgba(244,63,94,0.7)]",
    },
  },
  GLASS: (() => {
    // Opaque, darker stops with slightly darkened cells, so white text stays readable over the sidebar.
    const glass = {
      cell: "rounded-xl border border-white/30 bg-black/10 px-1 py-2 backdrop-blur-md",
      abbr: "text-[10px] font-semibold tracking-widest text-white",
      time: "font-display text-[15px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
    };
    return {
      // Vivid stops that keep the small white text at about 4.5:1 or better.
      BLUE: { ...glass, box: "mono-grayscale gap-1 rounded-2xl bg-gradient-to-br from-[#2f6bff] via-blue-600 to-indigo-600 p-1.5 shadow-lg shadow-blue-500/35" },
      // Darker than teal-500, where the small white text was about 2.5:1 contrast.
      GREEN: { ...glass, box: "mono-grayscale gap-1 rounded-2xl bg-gradient-to-br from-teal-700 via-emerald-700 to-green-800 p-1.5 shadow-lg shadow-emerald-500/35" },
      RED: { ...glass, box: "mono-grayscale gap-1 rounded-2xl bg-gradient-to-br from-rose-600 via-[#dc2626] to-red-700 p-1.5 shadow-lg shadow-red-500/35" },
    };
  })(),
};

/** Live Pacific / Central / Eastern clocks in one of the three templates and colors. */
export function UsClocks({ template, color = "BLUE", className = "" }: { template: ClockTemplate; color?: ThemeColor; className?: string }) {
  const now = useNow();
  const style = STYLES[template][color];
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

/** The clocks at the top of the dashboard sidebar, in the template and theme color chosen in Settings. */
export function SidebarClocks() {
  const user = useCurrentUser();
  // Users stored before templates or theme colors existed have neither (or the older clockColor).
  const color = user?.themeColor ?? (user as { clockColor?: ThemeColor } | null | undefined)?.clockColor ?? "BLUE";
  // Compact in the sidebar: smaller time and zone labels, tighter cells.
  return <UsClocks template={user?.clockTemplate ?? "MINIMALIST"} color={color} className="[&_li]:py-1.5 [&_p]:text-[9px] [&_time]:text-[13px]" />;
}
