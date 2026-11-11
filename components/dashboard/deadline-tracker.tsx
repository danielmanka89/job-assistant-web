"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createDeadline, deleteDeadline, listDeadlines, updateDeadline } from "@/lib/client/api";
import { useNow } from "@/lib/client/us-clock";
import {
  GROUP_LABEL,
  addDays,
  daysBetween,
  formatDay,
  groupOf,
  localDate,
  nextDeadline,
  relativeDay,
  visibleDeadlines,
  type DeadlineGroup,
} from "@/lib/deadlines";
import type { DeadlineItem, DeadlineKind } from "@/lib/types";

// The deadline tracker in the sidebar's bottom-left corner: a countdown to the next deadline that,
// on hover (or click / tap / Enter), slides out a panel of everything due, in one of three views.

type View = "timeline" | "tabs" | "board";
const VIEWS: { key: View; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "tabs", label: "Tabs" },
  { key: "board", label: "Board" },
];
const VIEW_KEY = "deadline-tracker-view";

const OPEN_DELAY = 120; // ms; skips accidental opens while the mouse passes over
const CLOSE_DELAY = 280; // ms; long enough to cross the gap between the widget and the panel

function savedView(): View {
  try {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem(VIEW_KEY);
    return saved === "timeline" || saved === "tabs" || saved === "board" ? saved : "timeline";
  } catch {
    return "timeline"; // storage blocked: the default view
  }
}

export function DeadlineTracker() {
  const now = useNow();
  const today = now ? localDate(now) : null;
  const [items, setItems] = useState<DeadlineItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by click / keyboard: stays until closed
  const [view, setView] = useState<View>(savedView); // the panel only renders in the browser
  const timer = useRef<number | undefined>(undefined);
  const panelRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const load = useCallback(async () => {
    const result = await listDeadlines();
    if (result.ok) {
      setItems(result.data);
      setLoadError(null);
    } else setLoadError(result.error.message);
  }, []);

  useEffect(() => {
    let live = true;
    listDeadlines().then((result) => {
      if (!live) return;
      if (result.ok) setItems(result.data);
      else setLoadError(result.error.message);
    });
    return () => {
      live = false;
    };
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  };

  const show = useCallback(
    (pin: boolean) => {
      window.clearTimeout(timer.current);
      if (!open) void load(); // fresh data each time it opens
      setOpen(true);
      if (pin) setPinned(true);
    },
    [open, load],
  );
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  const hoverIn = () => {
    window.clearTimeout(timer.current);
    if (!open) timer.current = window.setTimeout(() => show(false), OPEN_DELAY);
  };
  const hoverOut = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Keep it open while it's pinned or the user is typing in it.
      if (pinned || panelRef.current?.contains(document.activeElement)) return;
      setOpen(false);
    }, CLOSE_DELAY);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Escape closes; a click outside closes a pinned panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      hide();
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      hide();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, hide]);

  const visible = items && today ? visibleDeadlines(items, today) : null;
  const pending = visible?.filter((i) => !i.done) ?? [];
  const next = visible ? nextDeadline(visible) : null;

  async function toggleDone(item: DeadlineItem) {
    setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) ?? list);
    const result = await updateDeadline(item.id, !item.done);
    if (!result.ok) void load();
  }
  async function remove(item: DeadlineItem) {
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? list);
    const result = await deleteDeadline(item.id);
    if (!result.ok) void load();
  }
  const added = (item: DeadlineItem) => setItems((list) => [...(list ?? []), item]);

  return (
    <div className="mt-auto pt-6" onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open && pinned ? hide() : show(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={widgetLabel(next, pending.length, today)}
        className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none ${
          open
            ? "border-brand-200 bg-brand-50 shadow-lg shadow-brand-600/10 dark:border-brand-500/30 dark:bg-brand-500/10"
            : "border-neutral-200/80 bg-white hover:border-brand-200 hover:bg-brand-50/60 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-brand-500/30"
        }`}
      >
        <CountdownRing next={next} today={today} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tracking-widest text-brand-700 uppercase dark:text-brand-300">
              {next ? "Next up" : "Deadlines"}
            </span>
            {pending.length > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{pending.length} pending</span>
            )}
          </span>
          {visible === null ? (
            <span className="mt-1.5 block h-3 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
          ) : next && today ? (
            <>
              <span className="mt-0.5 block truncate text-sm font-semibold text-neutral-900 dark:text-white">{next.title}</span>
              <Countdown dueOn={next.dueOn!} now={now!} today={today} />
            </>
          ) : (
            <span className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400">{loadError ? "Couldn't load" : "Nothing due"}</span>
          )}
        </span>
      </button>

      {open &&
        createPortal(
          <section
            ref={panelRef}
            id={panelId}
            aria-label="Deadlines and pending work"
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={hoverOut}
            className={`fixed inset-2 z-[60] flex flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-2xl shadow-neutral-900/20 motion-safe:animate-panel-in sm:right-auto lg:left-[calc(18rem+0.5rem)] dark:border-neutral-800 dark:bg-neutral-950 ${
              view === "board" ? "sm:w-[44rem]" : "sm:w-[26rem]"
            } max-w-[calc(100vw-1rem)]`}
          >
            <PanelHeader today={today} visible={visible} view={view} onView={chooseView} onClose={hide} />
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4">
              {loadError && !items ? (
                <p className="px-3 py-6 text-sm text-neutral-600 dark:text-neutral-300">{loadError}</p>
              ) : !visible || !today ? (
                <ListSkeleton />
              ) : view === "timeline" ? (
                <TimelineView items={visible} today={today} onToggle={toggleDone} onRemove={remove} onNavigate={hide} />
              ) : view === "tabs" ? (
                <TabsView items={visible} today={today} onToggle={toggleDone} onRemove={remove} onNavigate={hide} />
              ) : (
                <BoardView items={visible} today={today} onToggle={toggleDone} onRemove={remove} onNavigate={hide} />
              )}
            </div>
            <AddDeadlineForm today={today} onAdded={added} />
          </section>,
          document.body,
        )}
    </div>
  );
}

function widgetLabel(next: DeadlineItem | null, count: number, today: string | null): string {
  const base = `Deadline tracker, ${count} pending`;
  return next?.dueOn && today ? `${base}. Next: ${next.title}, ${relativeDay(next.dueOn, today).toLowerCase()}` : base;
}

/** Fills up as the next deadline gets closer, over the last 7 days; full and pulsing once it's due. */
function CountdownRing({ next, today }: { next: DeadlineItem | null; today: string | null }) {
  const days = next?.dueOn && today ? daysBetween(today, next.dueOn) : null;
  const fill = days === null ? 0 : days <= 0 ? 1 : Math.max(0.08, 1 - days / 7);
  const C = 2 * Math.PI * 19;
  return (
    <svg viewBox="0 0 48 48" className={`size-11 shrink-0 ${days !== null && days <= 0 ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true">
      <circle cx="24" cy="24" r="19" fill="none" strokeWidth="4" className="stroke-brand-100 dark:stroke-brand-500/20" />
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - fill)}
        transform="rotate(-90 24 24)"
        className="stroke-brand-600 transition-[stroke-dashoffset] duration-700 dark:stroke-brand-400"
      />
      <path d="M24 15.5v8.5l5.5 3.5" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-brand-700 dark:stroke-brand-300" />
    </svg>
  );
}

/** "1d 04h 22m" until the start of the due day; "Due today" / "2 days late" once it's reached. */
function Countdown({ dueOn, now, today }: { dueOn: string; now: Date; today: string }) {
  const days = daysBetween(today, dueOn);
  let text: string;
  if (days < 0) text = relativeDay(dueOn, today);
  else if (days === 0) text = "Due today";
  else {
    const [y, m, d] = dueOn.split("-").map(Number);
    const ms = Math.max(0, new Date(y, m - 1, d).getTime() - now.getTime());
    const mins = Math.floor(ms / 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    text = `${Math.floor(mins / 1440)}d ${pad(Math.floor(mins / 60) % 24)}h ${pad(mins % 60)}m`;
  }
  return <span className={`block font-mono text-[13px] font-semibold ${days < 0 ? "text-red-600 dark:text-red-400" : "text-brand-700 dark:text-brand-300"}`}>{text}</span>;
}

function PanelHeader({
  today,
  visible,
  view,
  onView,
  onClose,
}: {
  today: string | null;
  visible: DeadlineItem[] | null;
  view: View;
  onView: (v: View) => void;
  onClose: () => void;
}) {
  const counts = { overdue: 0, soon: 0, later: 0 };
  if (visible && today) {
    for (const item of visible) {
      const g = groupOf(item, today);
      if (g === "overdue") counts.overdue++;
      else if (g === "today" || g === "week") counts.soon++;
      else if (g === "later") counts.later++;
    }
  }
  return (
    <header className="space-y-4 border-b border-neutral-100 px-5 pt-5 pb-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Deadlines &amp; pending</h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{today ? formatDay(today) : " "}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close deadlines"
          className="grid size-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat value={counts.overdue} label="Overdue" className="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" />
        <Stat value={counts.soon} label="This week" className="bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" />
        <Stat value={counts.later} label="Later" className="bg-neutral-100 text-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-300" />
      </div>
      <div role="group" aria-label="View" className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onView(v.key)}
            aria-pressed={view === v.key}
            className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition ${
              view === v.key
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${className}`}>
      <p className="text-xl leading-tight font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

type ItemHandlers = {
  today: string;
  onToggle: (item: DeadlineItem) => void;
  onRemove: (item: DeadlineItem) => void;
  onNavigate: () => void;
};

const TIMELINE_ORDER: DeadlineGroup[] = ["overdue", "today", "week", "ongoing", "later"];
const GROUP_HEADING: Record<DeadlineGroup, string> = {
  overdue: "text-red-700 dark:text-red-400",
  today: "text-amber-800 dark:text-amber-300",
  week: "text-amber-800 dark:text-amber-300",
  ongoing: "text-neutral-500 dark:text-neutral-400",
  later: "text-neutral-500 dark:text-neutral-400",
  done: "text-neutral-500 dark:text-neutral-400",
};

function TimelineView({ items, ...handlers }: { items: DeadlineItem[] } & ItemHandlers) {
  const open = items.filter((i) => !i.done);
  if (!open.length) return <Empty />;
  return (
    <>
      {TIMELINE_ORDER.map((group) => {
        const list = open.filter((i) => groupOf(i, handlers.today) === group);
        if (!list.length) return null;
        return (
          <section key={group} aria-label={GROUP_LABEL[group]}>
            <h3 className={`px-2 pt-4 pb-1.5 text-[11px] font-bold tracking-widest uppercase ${GROUP_HEADING[group]}`}>{GROUP_LABEL[group]}</h3>
            <ul className="space-y-1">
              {list.map((item) => (
                <ItemRow key={item.id} item={item} {...handlers} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

const TABS: { kind: DeadlineKind; label: string }[] = [
  { kind: "interview", label: "Interviews" },
  { kind: "follow_up", label: "Follow-ups" },
  { kind: "learning", label: "Learning" },
  { kind: "custom", label: "Mine" },
];

function TabsView({ items, ...handlers }: { items: DeadlineItem[] } & ItemHandlers) {
  const [tab, setTab] = useState<DeadlineKind>(() => TABS.find((t) => items.some((i) => i.kind === t.kind && !i.done))?.kind ?? "interview");
  const list = items.filter((i) => i.kind === tab);
  return (
    <>
      <div role="tablist" aria-label="Deadline type" className="sticky top-0 z-10 flex gap-1 overflow-x-auto bg-white pt-2 pb-2 dark:bg-neutral-950">
        {TABS.map((t) => {
          const count = items.filter((i) => i.kind === t.kind && !i.done).length;
          const active = tab === t.kind;
          return (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.kind)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                active ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {t.label}
              {count > 0 && <span className={`ml-1.5 ${active ? "text-white/80" : "text-brand-600 dark:text-brand-400"}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      {list.length ? (
        <ul role="tabpanel" className="space-y-1">
          {list.map((item) => (
            <ItemRow key={item.id} item={item} {...handlers} />
          ))}
        </ul>
      ) : (
        <Empty kind={tab} />
      )}
    </>
  );
}

function BoardView({ items, ...handlers }: { items: DeadlineItem[] } & ItemHandlers) {
  const columns: { key: string; label: string; tone: string; list: DeadlineItem[] }[] = [
    { key: "todo", label: "To do", tone: "text-red-700 dark:text-red-400", list: items.filter((i) => !i.done && (i.kind === "follow_up" || i.kind === "custom")) },
    { key: "waiting", label: "Waiting", tone: "text-amber-800 dark:text-amber-300", list: items.filter((i) => !i.done && (i.kind === "interview" || i.kind === "learning")) },
    { key: "done", label: "Done", tone: "text-neutral-500 dark:text-neutral-400", list: items.filter((i) => i.done) },
  ];
  return (
    <div className="grid gap-2 pt-2 sm:grid-cols-3">
      {columns.map((col) => (
        <section key={col.key} aria-label={col.label} className="rounded-2xl bg-neutral-50 p-2 dark:bg-neutral-900/60">
          <h3 className={`px-1.5 pt-1 pb-2 text-[11px] font-bold tracking-widest uppercase ${col.tone}`}>
            {col.label} · {col.list.length}
          </h3>
          {col.list.length ? (
            <ul className="space-y-1.5">
              {col.list.map((item) => (
                <ItemRow key={item.id} item={item} compact {...handlers} />
              ))}
            </ul>
          ) : (
            <p className="px-1.5 pb-2 text-xs text-neutral-500 dark:text-neutral-400">Nothing here</p>
          )}
        </section>
      ))}
    </div>
  );
}

const KIND_ICON: Record<DeadlineKind, React.ReactNode> = {
  interview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" strokeLinecap="round" />
    </svg>
  ),
  follow_up: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinejoin="round" />
    </svg>
  ),
  learning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]" aria-hidden="true">
      <path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" strokeLinejoin="round" />
      <path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11" strokeLinecap="round" />
    </svg>
  ),
  custom: null, // a checkbox instead
};

function ItemRow({ item, today, onToggle, onRemove, onNavigate, compact = false }: { item: DeadlineItem; compact?: boolean } & ItemHandlers) {
  const group = groupOf(item, today);
  const tone =
    group === "overdue"
      ? "bg-red-50 dark:bg-red-500/10"
      : group === "today" || group === "week"
        ? "ring-1 ring-amber-200 ring-inset dark:ring-amber-500/30"
        : "";
  const iconTone =
    group === "overdue"
      ? "bg-red-600 text-white"
      : group === "today" || group === "week"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";
  const when =
    item.progress !== null ? `${item.progress}%` : item.dueOn ? (group === "later" ? formatDay(item.dueOn) : relativeDay(item.dueOn, today)) : "";
  const whenTone = group === "overdue" ? "text-red-700 dark:text-red-400" : group === "today" || group === "week" ? "text-amber-800 dark:text-amber-300" : "text-neutral-500 dark:text-neutral-400";

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${item.done ? "text-neutral-400 line-through dark:text-neutral-500" : "text-neutral-900 dark:text-white"}`}>{item.title}</span>
        {item.progress !== null ? (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${item.progress}%` }} />
          </span>
        ) : (
          !compact && <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{item.detail}</span>
        )}
        {compact && when && <span className={`mt-0.5 block text-[11px] font-semibold ${whenTone}`}>{when}</span>}
      </span>
      {!compact && when && <span className={`shrink-0 text-xs font-semibold ${whenTone}`}>{when}</span>}
    </>
  );

  const rowClass = `group/row flex items-center gap-3 rounded-xl ${compact ? "bg-white p-2.5 dark:bg-neutral-950" : "p-2.5"} ${tone}`;

  if (item.kind === "custom") {
    return (
      <li className={rowClass}>
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onToggle(item)}
          aria-label={`Mark "${item.title}" ${item.done ? "not done" : "done"}`}
          className="size-5 shrink-0 cursor-pointer rounded-md accent-brand-600"
        />
        {body}
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`Delete "${item.title}"`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-400 opacity-0 transition group-hover/row:opacity-100 hover:bg-neutral-100 hover:text-red-600 focus-visible:opacity-100 dark:hover:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
            <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link href={item.href ?? "#"} onClick={onNavigate} className={`${rowClass} transition hover:bg-neutral-100 dark:hover:bg-neutral-800/70`}>
        {!compact && <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>{KIND_ICON[item.kind]}</span>}
        {body}
      </Link>
    </li>
  );
}

const EMPTY_TEXT: Record<DeadlineKind | "all", string> = {
  all: "Nothing due. Add a deadline below, or put an Interview Date on a Spreadsheet row.",
  interview: "No interviews coming up. Add an Interview Date on a Spreadsheet row to see it here.",
  follow_up: `Nothing to chase. Applications still waiting for a reply after a week show up here.`,
  learning: "No learning paths in progress. Start one on the Learning page.",
  custom: "No deadlines of your own yet. Add one below.",
};

function Empty({ kind = "all" }: { kind?: DeadlineKind | "all" }) {
  return <p className="px-3 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">{EMPTY_TEXT[kind]}</p>;
}

function ListSkeleton() {
  return (
    <div className="space-y-2 pt-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
      ))}
    </div>
  );
}

function AddDeadlineForm({ today, onAdded }: { today: string | null; onAdded: (item: DeadlineItem) => void }) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dateId = useId();
  const date = dueOn || (today ? addDays(today, 1) : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Say what's due");
    setSaving(true);
    setError(null);
    const result = await createDeadline({ title: title.trim(), dueOn: date });
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.error.fieldErrors ?? {})[0] ?? result.error.message);
    onAdded(result.data);
    setTitle("");
    setDueOn("");
  }

  return (
    <form onSubmit={submit} className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
      <div className="flex flex-wrap gap-2">
        <label htmlFor={titleId} className="sr-only">
          What&apos;s due
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Add a deadline…"
          className="min-w-0 flex-[999_1_10rem] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
        />
        <label htmlFor={dateId} className="sr-only">
          Due date
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          min={today ?? undefined}
          onChange={(e) => setDueOn(e.target.value)}
          className="flex-[1_1_8.5rem] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={saving || !date}
          className="flex-[1_1_4rem] rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
