import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary";
};

const variants = {
  primary:
    "bg-brand-600 text-white shadow-md shadow-brand-600/30 hover:bg-brand-700 focus-visible:ring-brand-500/40 dark:hover:bg-brand-500",
  secondary:
    "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:ring-neutral-400/30 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-800",
};

export function Button({
  loading = false,
  variant = "primary",
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-display text-[15px] font-medium uppercase tracking-wider transition outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
