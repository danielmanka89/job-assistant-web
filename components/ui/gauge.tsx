/** Ring showing a 0-100 percentage. */
export function Gauge({ percent, size = 112 }: { percent: number; size?: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Market Reach ${value}%`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className="stroke-brand-100 dark:stroke-brand-500/20" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="stroke-brand-600 transition-[stroke-dashoffset] duration-700 dark:stroke-brand-400"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-3xl font-semibold text-neutral-900 dark:text-white">{value}%</span>
    </div>
  );
}
