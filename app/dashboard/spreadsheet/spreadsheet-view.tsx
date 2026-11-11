"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, SheetKey, Submission } from "@/lib/types";
import { SHEETS, linkHref, rowLabel, workbookFileName, type Column, type Sheet } from "@/lib/spreadsheet";
import { createSubmission, deleteSubmission, exportSubmissions, listSubmissions, logout, updateSubmission } from "@/lib/client/api";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Load = { status: "loading" } | { status: "ready"; rows: Submission[] } | { status: "error"; message: string };
type Saving = { state: "idle" } | { state: "saving" } | { state: "saved" } | { state: "error"; message: string };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

/** The four sheets as tabs over one table of the user's submissions. Cells save when you leave them. */
export function SpreadsheetView() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<SheetKey>("vendor");
  const [saving, setSaving] = useState<Saving>({ state: "idle" });
  const [busy, setBusy] = useState<"add" | "export" | null>(null);
  const pending = useRef(0);

  useEffect(() => {
    let live = true;
    listSubmissions().then(async (result) => {
      if (!live) return;
      if (!result.ok && isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoad(result.ok ? { status: "ready", rows: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [attempt, router]);

  const rows = load.status === "ready" ? load.rows : [];
  const setRows = (update: (rows: Submission[]) => Submission[]) =>
    setLoad((l) => (l.status === "ready" ? { status: "ready", rows: update(l.rows) } : l));

  async function handleError(error: ApiError) {
    if (isUnauthorized(error)) {
      await logout();
      router.replace("/login");
      return;
    }
    setSaving({ state: "error", message: error.message });
  }

  async function saveCell(row: Submission, sheet: SheetKey, column: string, value: string) {
    // Show the edit straight away; put the old value back if the save fails.
    const previous = row[sheet][column] ?? "";
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [sheet]: { ...r[sheet], [column]: value } } : r)));
    pending.current += 1;
    setSaving({ state: "saving" });
    const result = await updateSubmission(row.id, { [sheet]: { [column]: value } });
    pending.current -= 1;
    if (result.ok) {
      // Take only this cell from the reply, so other edits still saving in the row aren't overwritten.
      const saved = result.data[sheet][column] ?? "";
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, updatedAt: result.data.updatedAt, [sheet]: { ...r[sheet], [column]: saved } } : r)));
      if (pending.current === 0) setSaving({ state: "saved" });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [sheet]: { ...r[sheet], [column]: previous } } : r)));
    if (result.error.code === "SUBMISSION_NOT_FOUND") setRows((rs) => rs.filter((r) => r.id !== row.id));
    const cellError = result.error.fieldErrors?.[`${sheet}.${column}`];
    await handleError(cellError ? { ...result.error, message: cellError } : result.error);
  }

  async function addRow() {
    setBusy("add");
    const result = await createSubmission({});
    setBusy(null);
    if (!result.ok) return handleError(result.error);
    setRows((rs) => [result.data.submission, ...rs]);
    setActive("submission"); // a blank row starts with the job and candidate
  }

  async function removeRow(row: Submission) {
    const { title, company } = rowLabel(row);
    if (!window.confirm(`Delete "${company ? `${title} at ${company}` : title}" from every sheet? This can't be undone.`)) return;
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    const result = await deleteSubmission(row.id);
    if (!result.ok && result.error.code !== "SUBMISSION_NOT_FOUND") {
      setRows((rs) => [...rs, row].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      await handleError(result.error);
    }
  }

  async function download() {
    setBusy("export");
    const result = await exportSubmissions();
    setBusy(null);
    if (!result.ok) return handleError(result.error);
    const url = URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = workbookFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (load.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading spreadsheet">
        <div className="h-11 w-full max-w-xl animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/60" />
        <div className="h-80 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <ErrorAlert>{load.message}</ErrorAlert>
        <Button
          type="button"
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const sheet = SHEETS.find((s) => s.key === active) ?? SHEETS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {rows.length} {rows.length === 1 ? "submission" : "submissions"}
          <span className="mx-2" aria-hidden="true">·</span>
          <SaveStatus saving={saving} />
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={addRow} loading={busy === "add"} disabled={busy !== null}>
            Add row
          </Button>
          <Button type="button" onClick={download} loading={busy === "export"} disabled={busy !== null}>
            Download Excel
          </Button>
        </div>
      </div>

      {saving.state === "error" && <ErrorAlert>{saving.message}</ErrorAlert>}

      <SheetTabs active={active} onChange={setActive} />
      {rows.length > 0 && (
        <p className="-mt-2 hidden text-xs text-neutral-500 [@media(pointer:fine)]:block dark:text-neutral-400">
          Scroll over the Job column to move up and down. Scroll anywhere else to move left and right.
        </p>
      )}

      <div
        role="tabpanel"
        id={`sheet-panel-${sheet.key}`}
        aria-labelledby={`sheet-tab-${sheet.key}`}
        // Opaque in dark mode (other cards are 60%) so the frozen Job column, which must be opaque
        // to hide cells scrolling under it, is the same color as the rest of the table.
        // glass-solid: stays opaque on the glass dashboard, so cells don't show through the sticky
        // header row and frozen Job column as they scroll underneath.
        className="glass-solid overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-neutral-900 dark:text-white">No submissions yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              Click <span className="font-semibold">Apply</span> on a job in the{" "}
              <Link href="/dashboard/jobs" className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                Job Board
              </Link>{" "}
              and it shows up here, or add a row by hand.
            </p>
          </div>
        ) : (
          <SheetTable sheet={sheet} rows={rows} onSave={saveCell} onDelete={removeRow} />
        )}
      </div>
    </div>
  );
}

function SaveStatus({ saving }: { saving: Saving }) {
  const text =
    saving.state === "saving" ? "Saving…" : saving.state === "error" ? "Last change not saved" : saving.state === "saved" ? "All changes saved" : "Changes save automatically";
  return (
    <span role="status" className={saving.state === "error" ? "font-medium text-rose-600 dark:text-rose-400" : undefined}>
      {text}
    </span>
  );
}

function SheetTabs({ active, onChange }: { active: SheetKey; onChange: (key: SheetKey) => void }) {
  const refs = useRef<Partial<Record<SheetKey, HTMLButtonElement | null>>>({});

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.key === "Home" ? 0 : event.key === "End" ? SHEETS.length - 1 : step ? (index + step + SHEETS.length) % SHEETS.length : null;
    if (target === null) return;
    event.preventDefault();
    onChange(SHEETS[target].key);
    refs.current[SHEETS[target].key]?.focus();
  }

  return (
    <div role="tablist" aria-label="Sheets" className="flex gap-1 overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      {SHEETS.map((s, i) => {
        const selected = s.key === active;
        return (
          <button
            key={s.key}
            ref={(el) => {
              refs.current[s.key] = el;
            }}
            type="button"
            role="tab"
            id={`sheet-tab-${s.key}`}
            aria-selected={selected}
            aria-controls={`sheet-panel-${s.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(s.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
              selected
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            }`}
          >
            <span className="mr-1.5 opacity-70">{i + 1}.</span>
            {s.title}
          </button>
        );
      })}
    </div>
  );
}

function SheetTable({
  sheet,
  rows,
  onSave,
  onDelete,
}: {
  sheet: Sheet;
  rows: Submission[];
  onSave: (row: Submission, sheet: SheetKey, column: string, value: string) => void;
  onDelete: (row: Submission) => void;
}) {
  // Grid lines like a spreadsheet: every cell has a right border, and each row draws the line above
  // it (on its own cells, so the frozen Job column can't cover it). The header and the Job column
  // get a darker line so they read as labels.
  const grid = "border-r border-t border-neutral-200 dark:border-neutral-700 [tbody>tr:first-child>&]:border-t-0";
  const th = `border-r border-b border-neutral-200 border-b-neutral-300 px-3 py-3 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-neutral-500 uppercase dark:border-neutral-700 dark:border-b-neutral-600 dark:text-neutral-400`;
  const jobColumn = "sticky left-0 z-10 min-w-36 border-r-neutral-300 sm:min-w-56 dark:border-r-neutral-600";
  const scroller = useRef<HTMLDivElement>(null);

  // The mouse wheel scrolls rows over the Job column and columns everywhere else, so the whole
  // sheet can be read without dragging a scrollbar. Sideways gestures (trackpad, Shift+wheel) and
  // pinch-zoom keep their usual behavior.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      if (e.target instanceof Element && e.target.closest("[data-job-column]")) return;
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll sideways
      // At the left or right edge, let the wheel scroll the page as usual instead of doing nothing.
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
      e.preventDefault();
      el.scrollLeft += e.deltaY * unit;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={scroller} className="scrollbar-slim max-h-[70vh] overflow-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{sheet.title}</caption>
        <thead className="sticky top-0 z-20 bg-neutral-50 dark:bg-neutral-800">
          <tr>
            <th scope="col" data-job-column className={`${th} ${jobColumn} bg-neutral-50 dark:bg-neutral-800`}>
              <span className="inline-block w-7" aria-hidden="true">
                #
              </span>
              Job
            </th>
            {sheet.columns.map((c) => (
              <th key={c.key} scope="col" className={th}>
                {c.label}
              </th>
            ))}
            <th scope="col" className={`${th} border-r-0`}>
              <span className="sr-only">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { title, company } = rowLabel(row);
            return (
              <tr key={row.id} className="group">
                <th
                  scope="row"
                  data-job-column
                  className={`${grid} ${jobColumn} max-w-40 bg-white px-3 py-2 text-left align-middle font-normal group-hover:bg-neutral-50 sm:max-w-64 dark:bg-neutral-900 dark:group-hover:bg-neutral-800`}
                >
                  <div className="flex items-baseline">
                    <span className="w-7 shrink-0 text-xs text-neutral-400 tabular-nums dark:text-neutral-500">{i + 1}</span>
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-neutral-900 dark:text-white" title={title}>
                        {title}
                      </span>
                      {company && <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{company}</span>}
                    </div>
                  </div>
                </th>
                {sheet.columns.map((c) => (
                  <td key={c.key} className={`${grid} px-1 py-1 align-middle group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800`}>
                    {c.type === "link" ? (
                      <RowLink column={c} rowId={row.id} label={`${c.label}, ${company ? `${title} at ${company}` : title}`} />
                    ) : (
                    <Cell
                      column={c}
                      value={row[sheet.key][c.key] ?? ""}
                      label={`${c.label}, ${company ? `${title} at ${company}` : title}`}
                      onSave={(value) => onSave(row, sheet.key, c.key, value)}
                    />
                    )}
                  </td>
                ))}
                <td className={`${grid} border-r-0 px-2 py-1 align-middle group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800`}>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${company ? `${title} at ${company}` : title}`}
                    title="Delete row"
                    className="grid size-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-4 focus-visible:ring-rose-500/20 focus-visible:outline-none dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CELL =
  "block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:bg-neutral-900";

/** A "link" column's cell: opens one of the row's pages, e.g. its mock call preparation. */
function RowLink({ column, rowId, label }: { column: Column; rowId: string; label: string }) {
  const href = linkHref(column, rowId);
  if (!href) return null;
  return (
    <Link
      href={href}
      aria-label={label}
      className="mx-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-brand-700 transition outline-none hover:bg-brand-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 4v-4h-1A1.5 1.5 0 0 1 4 14.5v-9Z" strokeLinejoin="round" />
        <path d="M9.8 8.6a2.2 2.2 0 1 1 3 2.1c-.5.2-.8.6-.8 1.1M12 13.6v.1" strokeLinecap="round" />
      </svg>
      Prepare
    </Link>
  );
}

/** One editable cell. Text saves when it loses focus (or on Enter); dropdowns and dates save on change. */
function Cell({ column, value, label, onSave }: { column: Column; value: string; label: string; onSave: (value: string) => void }) {
  // While editing, show the draft; otherwise show the saved value (which may change after a failed save).
  const [draft, setDraft] = useState<string | null>(null);
  const width = `${Math.max(9, column.width ?? 18) * 0.55}rem`;

  const commit = (next: string) => {
    setDraft(null);
    if (next.trim() !== value) onSave(next.trim());
  };

  if (column.type === "select") {
    return (
      <select aria-label={label} value={value} onChange={(e) => onSave(e.target.value)} className={CELL} style={{ minWidth: width }}>
        <option value="">—</option>
        {column.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "date") {
    return (
      <input
        type="date"
        aria-label={label}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className={CELL}
        style={{ minWidth: width }}
      />
    );
  }

  // Escape puts the saved value back, then leaves the cell without saving.
  const cancelOnEscape = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== "Escape") return;
    const field = e.currentTarget;
    setDraft(value);
    // Blur after the original value is back in the field, so nothing is saved.
    requestAnimationFrame(() => field.blur());
  };

  const shared = {
    "aria-label": label,
    value: draft ?? value,
    placeholder: "—",
    maxLength: 2000,
    onFocus: () => setDraft(value),
    onBlur: (e: { target: { value: string } }) => commit(e.target.value),
    className: CELL,
    style: { minWidth: width },
  };

  if (column.type === "long") {
    return (
      <textarea
        {...shared}
        rows={2}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={cancelOnEscape}
        className={`${CELL} resize-y leading-snug`}
      />
    );
  }
  return (
    <input
      {...shared}
      type="text"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        cancelOnEscape(e);
      }}
    />
  );
}
