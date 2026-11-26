import Link from "next/link";
import type { ReactNode } from "react";

// Glowing round icon buttons (Gray Glass design): teal for adding, silver for opening, pink for done.
// Icon-only, so each needs a label; it doubles as the hover tooltip.

export type OrbTone = "teal" | "silver" | "pink";

const SIZES = { sm: "size-9 [&_svg]:size-4", md: "size-11 [&_svg]:size-5", lg: "size-13 [&_svg]:size-6" } as const;

const orbClass = (tone: OrbTone, size: keyof typeof SIZES, onDark: boolean, extra = "") =>
  `orb ${tone === "silver" ? "" : `orb-${tone}`} ${onDark ? "orb-on-dark" : ""} ${SIZES[size]} shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 disabled:opacity-50 ${extra}`;

type Common = { label: string; tone: OrbTone; icon: OrbIcon; size?: keyof typeof SIZES; onDark?: boolean; className?: string };

export function OrbLink({ href, label, tone, icon, size = "md", onDark = false, className }: Common & { href: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={orbClass(tone, size, onDark, className)}>
      {ICONS[icon]}
    </Link>
  );
}

export function OrbButton({
  label,
  tone,
  icon,
  size = "md",
  onDark = false,
  className,
  onClick,
  disabled,
}: Common & { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={orbClass(tone, size, onDark, className)}>
      {ICONS[icon]}
    </button>
  );
}

export type OrbIcon = "plus" | "arrow" | "check";

const ICONS: Record<OrbIcon, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 4v16M4 12h16" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 18 18 6M8 6h10v10" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/** A text link in the glass style: a pill with the dark sunken center. */
export function GlassPillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="pill-glass inline-flex rounded-full p-1 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40">
      <span className="pill-seg-on rounded-full px-4 py-1.5 text-[13px] font-medium">{children}</span>
    </Link>
  );
}
