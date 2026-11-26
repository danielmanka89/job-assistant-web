"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand";
import { RingAvatar } from "@/components/ui/ring-avatar";
import { ThemeSwitch } from "@/components/theme-toggle";
import { SidebarClocks } from "@/components/dashboard/us-clocks";
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker";
import { CHAT_CHANGED_EVENT, answerFollowRequest, getChatSummary, logout } from "@/lib/client/api";
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
    href: "/dashboard/jds",
    label: "My JDs",
    match: (p) => under(p, "/dashboard/jds"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9L14 3.5Z" strokeLinejoin="round" />
        <path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
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
];

/** Settings lives in the account menu (click your name), not the main menu. */
const SETTINGS_ICON = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          strokeLinejoin="round"
        />
      </svg>
);

const ROLE_LABEL: Record<User["role"], string> = { SEEKER: "Job Seeker", EMPLOYER: "Employer" };

/**
 * Laptops: a glass bar across the top (menu, deadlines, light/dark, your account). Phones
 * and tablets: a deep-colored top bar with a slide-in menu.
 */
export function Sidebar() {
  const pathname = usePathname() ?? "";
  // The phone menu remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const user = useCurrentUser();
  const chat = useChatSummary(Boolean(user));
  const waiting = chat?.requests ?? 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Phones: a bar in the theme's deep color that runs up under the status bar (--safe-top). */}
      <div id="mobile-topbar" className="sticky top-0 z-30 flex h-[calc(4rem+var(--safe-top))] items-center justify-between pt-(--safe-top) pr-16 pl-4 sm:pl-6 lg:hidden">
        <Logo light />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={waiting ? `Open menu, ${waiting} new notification${waiting === 1 ? "" : "s"}` : "Open menu"}
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
          className="relative grid size-10 place-items-center rounded-xl text-white transition hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
          {/* New notifications wait in the account menu (tap your name). */}
          {waiting > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-(--peach) ring-2 ring-white/20" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <DesktopTopBar pathname={pathname} user={user} chat={chat} />

      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col pt-(--safe-top) pb-(--safe-bottom) text-white transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <Logo light />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <SidebarContent pathname={pathname} user={user} chat={chat} />
      </aside>
    </>
  );
}

/** The laptop menu: one glass bar across the top of every dashboard page. */
function DesktopTopBar({ pathname, user, chat }: { pathname: string; user: User | null | undefined; chat: ChatSummary | null }) {
  const router = useRouter();
  const items = NAV.filter((item) => !item.employerOnly || user?.role === "EMPLOYER");

  async function signOut() {
    await logout();
    router.replace("/");
  }

  return (
    <header className="pill-glass fixed inset-x-3 top-3 z-40 hidden h-(--topbar-inner-h) items-center gap-3 rounded-full py-2 pr-2 pl-3 lg:flex">
      <Logo className="shrink-0 [&>span:last-child]:hidden 2xl:[&>span:last-child]:inline" />
      <nav aria-label="Main" className="min-w-0 flex-1">
        <ul className="flex items-center gap-0.5">
          {items.map((item) => {
            const active = item.match(pathname);
            const count = item.href === "/dashboard/chat" ? chat?.unread : item.href === "/dashboard/inbox" ? chat?.emailUnread : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`relative flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 ${
                    active ? "pill-seg-on" : "pill-seg-off hover:bg-white/40 dark:hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                  <span className="hidden xl:inline">{item.label}</span>
                  {count ? (
                    <span className="absolute -top-0.5 right-0.5 rounded-full bg-brand-600 px-1 text-[9px] leading-4 font-bold text-white tabular-nums xl:static xl:ml-0.5 xl:px-1.5">
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <DeadlineTracker compact />
      <ThemeSwitch />
      <AccountButton user={user} chat={chat} pathname={pathname} onSignOut={signOut} />
    </header>
  );
}

/** Your ringed picture in the top bar; opens Notifications, Settings and Sign out. */
function AccountButton({
  user,
  chat,
  pathname,
  onSignOut,
}: {
  user: User | null | undefined;
  chat: ChatSummary | null;
  pathname: string;
  onSignOut: () => void;
}) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const boxRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, boxRef, () => setOpenOn(null));
  const waiting = chat?.requests ?? 0;
  const name = user?.name || "Your account";

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        disabled={!user}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${name}: notifications and settings${waiting ? `, ${waiting} new` : ""}`}
        className="relative grid size-11 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40"
      >
        <RingAvatar name={name} photoUrl={user?.avatarUrl ?? user?.profilePictureUrl} ring={user?.ringStyle} className="size-10" />
        {waiting > 0 && (
          <span className="absolute -top-1 -right-1 z-10 grid min-w-4.5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-4.5 font-bold text-white tabular-nums">
            {waiting > 9 ? "9+" : waiting}
          </span>
        )}
      </button>
      {open && user && (
        <AccountMenu id={menuId} chat={chat} pathname={pathname} onSignOut={onSignOut} header={name} className="right-0 left-auto w-80" />
      )}
    </div>
  );
}

/** Closes a popup on Escape (without closing anything behind it) or a click outside `box`. */
function useDismiss(open: boolean, box: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, box, close]);
}

function SidebarContent({ pathname, user, chat }: { pathname: string; user: User | null | undefined; chat: ChatSummary | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const items = NAV.filter((item) => !item.employerOnly || user?.role === "EMPLOYER");

  async function signOut() {
    setSigningOut(true);
    await logout();
    router.replace("/"); // back to the landing page
  }

  // Compact rows (36px) so clocks, account, menu and the deadline tracker all fit without scrolling.
  const itemClass = "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-white/80";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
      <SidebarClocks />
      <UserCard user={user} chat={chat} onSignOut={signOut} signingOut={signingOut} pathname={pathname} className="mt-3 z-10" />
      <div className="mt-2.5 flex justify-end px-0.5">
        <ThemeSwitch />
      </div>

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
                      ? "bg-(--menu-pill) font-semibold text-(--menu-pill-text)"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
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
function UnreadBadge({ count, what, active = false }: { count: number | undefined; what: string; active?: boolean }) {
  if (!count || count < 1) return null;
  return (
    // On the active item's pill, peach would blend in, so the badge turns dark.
    <span className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${active ? "bg-(--menu-pill-text) text-white" : "bg-(--peach) text-neutral-900"}`}>
      {count > 99 ? "99+" : count}
      <span className="sr-only"> unread {what}</span>
    </span>
  );
}

const SUMMARY_POLL_MS = 30000;

/**
 * Unread messages, unread emails and connection counts for the menu; refreshed every 30 seconds and
 * whenever chat changes. Each request is also the "in the app" check-in that shows you as ON in
 * Chat, so it pauses while the tab is hidden (you turn OFF) and runs again the moment you come back.
 */
function useChatSummary(enabled: boolean): ChatSummary | null {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void getChatSummary().then((result) => {
        if (live && result.ok) setSummary(result.data);
      });
    };
    load();
    const timer = setInterval(load, SUMMARY_POLL_MS);
    window.addEventListener(CHAT_CHANGED_EVENT, load);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CHAT_CHANGED_EVENT, load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  return summary;
}

function UserCard({
  user,
  chat,
  onSignOut,
  signingOut,
  pathname,
  className = "",
}: {
  user: User | null | undefined;
  chat: ChatSummary | null;
  onSignOut: () => void;
  signingOut: boolean;
  pathname: string;
  className?: string;
}) {
  // The menu remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const boxRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // close this menu, not the phone drawer around it
      setOpenOn(null);
    };
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenOn(null);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // undefined while rendering on the server: keep the space so the layout doesn't jump.
  if (user === undefined) {
    return <div className={`h-[58px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900 ${className}`} aria-hidden="true" />;
  }
  const name = user?.name || "Your account";
  const waiting = chat?.requests ?? 0;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-neutral-50 p-1.5 dark:border-neutral-800 dark:bg-neutral-900/60">
        <button
          type="button"
          onClick={() => setOpenOn(open ? null : pathname)}
          disabled={!user}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`${name}: notifications and settings${waiting ? `, ${waiting} new` : ""}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-neutral-800/70"
        >
          <span className="relative shrink-0">
            {/* The menu photo, or the portfolio photo until one is set. */}
            <RingAvatar name={user?.name ?? "Your account"} photoUrl={user?.avatarUrl ?? user?.profilePictureUrl} ring={user?.ringStyle} className="size-9" />
            {waiting > 0 && (
              <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] leading-4 font-bold text-white tabular-nums ring-2 ring-neutral-50 dark:ring-neutral-900">
                {waiting > 9 ? "9+" : waiting}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-tight font-semibold text-neutral-900 dark:text-white">{name}</span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-neutral-500 tabular-nums dark:text-neutral-400">
              {user && <span className="font-semibold text-brand-700 dark:text-brand-300">{ROLE_LABEL[user.role]}</span>}
              {/* Follower counts (anyone can see these; the names stay private). */}
              {chat && ` · ${chat.connectedToMe} ${chat.connectedToMe === 1 ? "follower" : "followers"} · ${chat.connectedTo} following`}
            </span>
          </span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`size-4 shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

      {open && user && <AccountMenu id={menuId} chat={chat} pathname={pathname} />}
    </div>
  );
}

/**
 * The panel under your name: notifications (follow requests for now) and Settings. Sections are
 * stacked so more can be added later.
 */
function AccountMenu({
  id,
  chat,
  pathname,
  onSignOut,
  header,
  className = "inset-x-0",
}: {
  id: string;
  chat: ChatSummary | null;
  pathname: string;
  onSignOut?: () => void;
  header?: string;
  className?: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, "accepted" | "declined">>({});
  const requesters = chat?.requesters ?? [];
  const more = Math.max(0, (chat?.requests ?? 0) - requesters.length);
  const settingsActive = under(pathname, "/dashboard/settings");

  async function answer(personId: string, accept: boolean) {
    setBusyId(personId);
    const result = await answerFollowRequest(personId, accept);
    setBusyId(null);
    if (result.ok) setAnswered((a) => ({ ...a, [personId]: accept ? "accepted" : "declined" }));
  }

  const sectionTitle = "px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400";

  return (
    <div
      id={id}
      className={`absolute ${className} top-full z-20 mt-1.5 max-h-[60vh] overflow-y-auto rounded-xl border border-neutral-200/80 bg-white p-1.5 text-neutral-900 shadow-xl shadow-neutral-900/15 [scrollbar-width:none] motion-safe:animate-panel-in dark:border-neutral-800 dark:bg-neutral-900 dark:text-white`}
    >
      {header && <p className="truncate px-2.5 pt-1.5 pb-1 text-sm font-semibold">{header}</p>}
      <section aria-labelledby={`${id}-notes`}>
        <h2 id={`${id}-notes`} className={sectionTitle}>
          Notifications
        </h2>
        {requesters.length === 0 ? (
          <p className="px-2.5 pb-2 text-xs text-neutral-500 dark:text-neutral-400">You&apos;re all caught up.</p>
        ) : (
          <ul className="space-y-1">
            {requesters.map((person) => {
              const done = answered[person.id];
              return (
                <li key={person.id} className="rounded-lg bg-neutral-50 px-2.5 py-2 dark:bg-neutral-800/60">
                  <p className="text-xs leading-snug">
                    <span className="font-semibold">{person.name}</span> {done ? `· request ${done}` : "wants to follow you"}
                  </p>
                  {!done && (
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === person.id}
                        onClick={() => void answer(person.id, true)}
                        className="flex-1 rounded-lg bg-brand-600 py-1 text-[11px] font-semibold text-white transition outline-none hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === person.id}
                        onClick={() => void answer(person.id, false)}
                        className="flex-1 rounded-lg border border-neutral-300 py-1 text-[11px] font-semibold text-neutral-700 transition outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(more > 0 || requesters.length > 0) && (
          <Link
            href="/dashboard/chat?tab=people"
            className="mt-1 block rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300 dark:hover:bg-neutral-800"
          >
            {more > 0 ? `See all requests (+${more} more)` : "See all in Chat → People"}
          </Link>
        )}
      </section>

      <div className="my-1.5 border-t border-neutral-200/80 dark:border-neutral-800" />

      <Link
        href="/dashboard/settings"
        aria-current={settingsActive ? "page" : undefined}
        className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
          settingsActive ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
        }`}
      >
        {SETTINGS_ICON}
        Settings
      </Link>
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      )}
    </div>
  );
}
