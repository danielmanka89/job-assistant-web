"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { SidebarClocks } from "@/components/dashboard/us-clocks";
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker";
import { CHAT_CHANGED_EVENT, getChatSummary, logout } from "@/lib/client/api";
import { useCurrentUser } from "@/lib/client/current-user";
import type { ChatSummary, User } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
  employerOnly?: boolean;
};

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const ICON = "size-[18px] shrink-0";
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
    href: "/dashboard/profile",
    label: "My Profile",
    match: (p) => under(p, "/dashboard/profile"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <circle cx="9" cy="11" r="2.25" />
        <path d="M5.75 16.5a3.5 3.5 0 0 1 6.5 0M14.5 10h3.5M14.5 13.5h3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/learning",
    label: "Learning",
    match: (p) => under(p, "/dashboard/learning"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" strokeLinejoin="round" />
        <path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5.5" strokeLinecap="round" strokeLinejoin="round" />
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
    href: "/dashboard/spreadsheet",
    label: "Spreadsheet",
    match: (p) => under(p, "/dashboard/spreadsheet"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M3.5 14.75h17M9.5 9.5V20" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/chat",
    label: "Chat",
    match: (p) => under(p, "/dashboard/chat"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 4v-4h-1A1.5 1.5 0 0 1 4 14.5v-9Z" strokeLinejoin="round" />
        <path d="M8.5 9h7M8.5 12h4.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/inbox",
    label: "Inbox",
    match: (p) => under(p, "/dashboard/inbox"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 7 8.5 6.5L20.5 7" strokeLinecap="round" strokeLinejoin="round" />
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
  {
    href: "/dashboard/settings",
    label: "Settings",
    match: (p) => under(p, "/dashboard/settings"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const ROLE_LABEL: Record<User["role"], string> = { SEEKER: "Job Seeker", EMPLOYER: "Employer" };

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
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200/80 bg-white/90 pr-16 pl-4 backdrop-blur sm:pl-6 lg:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
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
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
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
  const chat = useChatSummary(Boolean(user));

  async function signOut() {
    setSigningOut(true);
    await logout();
    router.replace("/"); // back to the landing page
  }

  // Compact rows (36px) so clocks, account, menu and the deadline tracker all fit without scrolling.
  const itemClass = "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
      <SidebarClocks />
      <UserCard user={user} chat={chat} onSignOut={signOut} signingOut={signingOut} className="mt-3" />

      <nav aria-label="Main" className="mt-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemClass} ${
                    active
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/70 dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  <UnreadBadge count={item.href === "/dashboard/chat" ? chat?.unread : item.href === "/dashboard/inbox" ? chat?.emailUnread : 0} what={item.href === "/dashboard/inbox" ? "emails" : "messages"} active={active} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user?.role !== "EMPLOYER" && <DeadlineTracker />}
    </div>
  );
}

/** The number at the end of a menu item (unread chat messages, unread emails); nothing when it's zero. */
function UnreadBadge({ count, what, active }: { count: number | undefined; what: string; active: boolean }) {
  if (!count || count < 1) return null;
  return (
    <span className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${active ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`}>
      {count > 99 ? "99+" : count}
      <span className="sr-only"> unread {what}</span>
    </span>
  );
}

const SUMMARY_POLL_MS = 30000;

/** Unread messages, unread emails and connection counts for the menu; refreshed every 30 seconds and whenever chat changes. */
function useChatSummary(enabled: boolean): ChatSummary | null {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      void getChatSummary().then((result) => {
        if (live && result.ok) setSummary(result.data);
      });
    load();
    const timer = setInterval(load, SUMMARY_POLL_MS);
    window.addEventListener(CHAT_CHANGED_EVENT, load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CHAT_CHANGED_EVENT, load);
    };
  }, [enabled]);
  return summary;
}

function UserCard({
  user,
  chat,
  onSignOut,
  signingOut,
  className = "",
}: {
  user: User | null | undefined;
  chat: ChatSummary | null;
  onSignOut: () => void;
  signingOut: boolean;
  className?: string;
}) {
  // undefined while rendering on the server: keep the space so the layout doesn't jump.
  if (user === undefined) {
    return <div className={`h-[58px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900 ${className}`} aria-hidden="true" />;
  }
  const name = user?.name || "Your account";
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/60 ${className}`}>
      {/* The menu photo, or the portfolio photo until one is set. */}
      <Avatar name={user?.name ?? "?"} photoUrl={user?.avatarUrl ?? user?.profilePictureUrl} className="size-9 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight font-semibold text-neutral-900 dark:text-white">{name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
          {user && <span className="font-semibold text-brand-700 dark:text-brand-300">{ROLE_LABEL[user.role]}</span>}
          {/* The account's connections: people you're connected to, and people connected to you. */}
          {user && chat && (
            <Link
              href="/dashboard/chat"
              title={`Connected to ${chat.connectedTo} · ${chat.connectedToMe} connected to you`}
              className="truncate rounded tabular-nums hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:text-white"
            >
              <span aria-hidden="true">· </span>
              {chat.connectedTo} connected<span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {chat.connectedToMe} to you
            </Link>
          )}
        </p>
      </div>
      {user && (
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          aria-label={signingOut ? "Signing out" : "Sign out"}
          title="Sign out"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:opacity-60 dark:text-neutral-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-[18px]" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
