"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Tailor resume", match: (p: string) => p.startsWith("/dashboard") && !p.startsWith("/dashboard/jobs") },
  { href: "/dashboard/jobs", label: "Job board", match: (p: string) => p.startsWith("/dashboard/jobs") },
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
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
