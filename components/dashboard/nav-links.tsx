"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/dashboard",
    label: "Tailor resume",
    match: (p: string) => p.startsWith("/dashboard") && !p.startsWith("/dashboard/jobs") && !p.startsWith("/dashboard/employer"),
  },
  { href: "/dashboard/jobs", label: "Job board", match: (p: string) => p.startsWith("/dashboard/jobs") },
  { href: "/dashboard/employer", label: "Post a job", match: (p: string) => p.startsWith("/dashboard/employer") },
];

export function NavLinks() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 font-display text-[15px] font-medium uppercase tracking-wider transition ${
              active
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
