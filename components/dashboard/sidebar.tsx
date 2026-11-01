"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand";
import { logout } from "@/lib/client/api";
import { useCurrentUser } from "@/lib/client/current-user";
import type { User } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
  employerOnly?: boolean;
};

const TAILOR_FLOW = ["/dashboard/upload", "/dashboard/review", "/dashboard/analyze", "/dashboard/download"];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const ICON = "size-5 shrink-0";
const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p === "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
        <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
        <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/jobs",
    label: "Job Board",
    match: (p) => under(p, "/dashboard/jobs"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/upload",
    label: "Upload Resume",
    match: (p) => TAILOR_FLOW.some((prefix) => under(p, prefix)),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
        <path d="M14 3v5h5M12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/employer",
    label: "Post a Job",
    match: (p) => under(p, "/dashboard/employer"),
    employerOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ROLE_LABEL: Record<User["role"], string> = { SEEKER: "Job Seeker", EMPLOYER: "Employer" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Left sidebar on large screens; a top bar with a slide-in menu on phones and tablets. */
export function Sidebar() {
  const pathname = usePathname() ?? "";
  // The phone menu remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200/80 bg-white/90 px-4 backdrop-blur sm:px-6 lg:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
          className="grid size-10 place-items-center rounded-xl text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-neutral-200/80 bg-white transition-transform duration-200 lg:translate-x-0 dark:border-neutral-800 dark:bg-neutral-950 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const items = NAV.filter((item) => !item.employerOnly || user?.role === "EMPLOYER");

  async function signOut() {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  const itemClass = "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      <UserCard user={user} />

      <nav aria-label="Main" className="mt-6">
        <p className="px-3.5 pb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
          Menu
        </p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemClass} ${
                    active
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/70 dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className={`${itemClass} text-neutral-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function UserCard({ user }: { user: User | null | undefined }) {
  // undefined while rendering on the server: keep the space so the layout doesn't jump.
  if (user === undefined) {
    return <div className="h-[76px] animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />;
  }
  const name = user?.name || "Your account";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-lg font-semibold text-white shadow-md shadow-brand-600/25">
        {user ? initials(user.name) : "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-neutral-900 dark:text-white">{name}</p>
        {user && (
          <p className="mt-0.5 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {ROLE_LABEL[user.role]}
          </p>
        )}
      </div>
    </div>
  );
}
