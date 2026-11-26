"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GeneratedFile, User, VendorJd, VendorJdFields } from "@/lib/types";
import { VENDOR_JD_MAX_CHARS, VENDOR_JD_MIN_CHARS } from "@/lib/types";
import { createVendorJd, deleteVendorJd, listVendorJds, logout, sendVendorJd, tailorVendorJd, updateVendorJd } from "@/lib/client/api";
import { useCurrentUser } from "@/lib/client/current-user";
import { Button } from "@/components/ui/button";
import { ErrorAlert, SuccessAlert } from "@/components/ui/alert";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

type Filter = "all" | "tailor" | "send" | "sent";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tailor", label: "Not tailored" },
  { key: "send", label: "Ready to send" },
  { key: "sent", label: "Sent" },
];

const statusOf = (jd: VendorJd): Exclude<Filter, "all"> => (jd.sentAt ? "sent" : jd.tailored ? "send" : "tailor");

const CARD = "rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const isUnauthorized = (code: string) => code === "UNAUTHORIZED" || code === "HTTP_401";

type TailorProblem = { message: string; noResume: boolean };

/** A copy of `all` without `key`. */
function without<T>(all: Record<string, T>, key: string): Record<string, T> {
  const next = { ...all };
  delete next[key];
  return next;
}

export function JdsView() {
  const router = useRouter();
  const user = useCurrentUser();
  const [jds, setJds] = useState<VendorJd[] | null>(null);
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<{ id: string; panel: Panel } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState<Set<string>>(() => new Set());
  const [problems, setProblems] = useState<Record<string, TailorProblem>>({});

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    let live = true;
    listVendorJds().then((result) => {
      if (!live) return;
      if (!result.ok) {
        if (isUnauthorized(result.error.code)) {
          void signOut();
          return;
        }
        setLoadError(result.error.message);
        return;
      }
      setJds(result.data.jds);
      setCanSendEmail(result.data.canSendEmail);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const counts = useMemo(() => {
    const c = { all: 0, tailor: 0, send: 0, sent: 0 };
    for (const jd of jds ?? []) {
      c.all += 1;
      c[statusOf(jd)] += 1;
    }
    return c;
  }, [jds]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (jds ?? []).filter((jd) => {
      if (filter !== "all" && statusOf(jd) !== filter) return false;
      if (!q) return true;
      return [jd.title, jd.client, jd.location, jd.vendorCompany, jd.vendorContact, jd.vendorEmail, jd.jobDescription].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [jds, filter, query]);

  function replace(jd: VendorJd) {
    setJds((list) => (list ?? []).map((j) => (j.id === jd.id ? jd : j)));
  }

  /** Tailors the resume to one JD; the row shows progress, then the downloads (or what went wrong). */
  async function tailor(id: string) {
    setTailoring((s) => new Set(s).add(id));
    setProblems((all) => without(all, id));
    const result = await tailorVendorJd(id);
    setTailoring((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (!result.ok) {
      const { code, message } = result.error;
      if (isUnauthorized(code)) return signOut();
      setProblems((p) => ({ ...p, [id]: { message, noResume: code === "NO_RESUME" } }));
      return;
    }
    replace(result.data);
  }

  async function onDelete(jd: VendorJd) {
    if (!window.confirm(`Delete "${jd.title}"? Its resume files and Spreadsheet row stay.`)) return;
    const result = await deleteVendorJd(jd.id);
    if (!result.ok) {
      if (isUnauthorized(result.error.code)) return signOut();
      window.alert(result.error.message);
      return;
    }
    setJds((list) => (list ?? []).filter((j) => j.id !== jd.id));
  }

  if (loadError) return <ErrorAlert>{loadError}</ErrorAlert>;
  if (!jds) return <div className="h-64 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" aria-busy="true" />;

  const showForm = adding || jds.length === 0;

  return (
    <div className="space-y-5">
      {notice && <SuccessAlert>{notice}</SuccessAlert>}

      {showForm ? (
        <AddJd
          canCancel={jds.length > 0}
          onCancel={() => setAdding(false)}
          onUnauthorized={signOut}
          onSaved={(jd) => {
            setJds((list) => [jd, ...(list ?? [])]);
            setAdding(false);
            setFilter("all");
            setQuery("");
            setNotice(null);
            void tailor(jd.id);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-75">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search role, client, vendor…"
              aria-label="Search your JDs"
              className="w-full min-w-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 sm:w-60 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAdding(true);
                setNotice(null);
              }}
              className="shrink-0"
            >
              + Add a JD
            </Button>
          </div>
        </div>
      )}

      {jds.length > 0 && shown.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">No JDs match. Try another filter or search.</p>
      )}

      <ul className="space-y-3">
        {shown.map((jd) => (
          <JdRow
            key={jd.id}
            jd={jd}
            user={user ?? null}
            canSendEmail={canSendEmail}
            tailoring={tailoring.has(jd.id)}
            problem={problems[jd.id] ?? null}
            panel={open?.id === jd.id ? open.panel : null}
            onPanel={(panel) => setOpen(panel ? { id: jd.id, panel } : null)}
            onTailor={() => tailor(jd.id)}
            onDelete={() => onDelete(jd)}
            onEdited={(next) => {
              replace(next);
              setOpen(null);
              // A new description unlinks the old files: tailor to the new text straight away.
              if (!next.tailored && jd.tailored) void tailor(next.id);
              else setNotice("Changes saved.");
            }}
            onSent={(next, message) => {
              replace(next);
              setOpen(null);
              setNotice(message);
            }}
            onUnauthorized={signOut}
          />
        ))}
      </ul>
    </div>
  );
}

/* ---------- add ---------- */

function AddJd({
  canCancel,
  onCancel,
  onSaved,
  onUnauthorized,
}: {
  canCancel: boolean;
  onCancel: () => void;
  onSaved: (jd: VendorJd) => void;
  onUnauthorized: () => void;
}) {
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = text.trim();
    if (value.length < VENDOR_JD_MIN_CHARS) {
      setFieldError(value ? `That looks too short. Paste the full JD (at least ${VENDOR_JD_MIN_CHARS} characters).` : "Paste the JD first");
      return;
    }
    setSaving(true);
    const result = await createVendorJd({ jobDescription: value });
    setSaving(false);
    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (isUnauthorized(code)) return onUnauthorized();
      if (fieldErrors?.jobDescription) setFieldError(fieldErrors.jobDescription);
      else setError(message);
      return;
    }
    onSaved(result.data);
  }

  return (
    <section aria-labelledby="add-jd" className={`${CARD} p-5 sm:p-6`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="add-jd" className="text-base font-semibold text-neutral-900 dark:text-white">
            Add a JD
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Paste the whole email from the vendor, signature included. We pick out the role, client, rate and vendor details, then tailor
            your resume to it.
          </p>
        </div>
        {canCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            Cancel
          </button>
        )}
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <TextArea
          label="Job description"
          hideLabel
          rows={10}
          maxLength={VENDOR_JD_MAX_CHARS}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (fieldError) setFieldError(undefined);
          }}
          placeholder={"Paste the JD here…\n\nJob Title: …\nClient: …\nLocation: …\nRate: …\n\nThanks,\nRecruiter name\nVendor company\nrecruiter@vendor.com"}
          error={fieldError}
          disabled={saving}
        />
        <div className="flex items-center justify-end">
          <Button type="submit" size="sm" loading={saving}>
            {saving ? "Reading the JD…" : "Save & tailor my resume"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ---------- one JD ---------- */

type Panel = "jd" | "edit" | "send";

type RowProps = {
  jd: VendorJd;
  user: User | null;
  canSendEmail: boolean;
  tailoring: boolean;
  problem: TailorProblem | null;
  panel: Panel | null;
  onPanel: (panel: Panel | null) => void;
  onTailor: () => void;
  onDelete: () => void;
  onEdited: (jd: VendorJd) => void;
  onSent: (jd: VendorJd, message: string) => void;
  onUnauthorized: () => void;
};

function JdRow({ jd, user, canSendEmail, tailoring, problem, panel, onPanel, onTailor, onDelete, onEdited, onSent, onUnauthorized }: RowProps) {
  const pdf = jd.tailored?.files.find((f) => f.format === "pdf");
  const docx = jd.tailored?.files.find((f) => f.format === "docx");
  const facts = [jd.client, jd.location, jd.rate].filter(Boolean);
  const vendor = [jd.vendorCompany, jd.vendorContact].filter(Boolean).join(" · ");
  const toggle = (p: Panel) => onPanel(panel === p ? null : p);

  return (
    <li className={`${CARD} p-4 sm:p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white">{jd.title}</h3>
            <StatusPill jd={jd} tailoring={tailoring} />
          </div>
          {facts.length > 0 && <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">{facts.join(" · ")}</p>}
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {vendor ? `From ${vendor}` : "Vendor not found in the JD"}
            {jd.vendorEmail && ` · ${jd.vendorEmail}`} · Saved {shortDate(jd.createdAt)}
          </p>
        </div>
        {jd.tailored && !tailoring && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={jd.sentAt ? "secondary" : "primary"} onClick={() => toggle("send")} aria-expanded={panel === "send"}>
              {jd.sentAt ? "Send again" : "Send to vendor"}
            </Button>
          </div>
        )}
      </div>

      {/* The tailored resume: progress, the downloads, or what went wrong. */}
      {tailoring ? (
        <p className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:bg-brand-500/10 dark:text-brand-200" aria-live="polite">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          Tailoring your resume to this JD… this takes about a minute.
        </p>
      ) : problem ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between dark:bg-rose-500/10 dark:text-rose-200">
          <span>{problem.message}</span>
          {problem.noResume ? (
            <Link href="/dashboard/upload" className="shrink-0 font-semibold underline">
              Upload your resume
            </Link>
          ) : (
            <button type="button" onClick={onTailor} className="shrink-0 text-left font-semibold underline">
              Try again
            </button>
          )}
        </div>
      ) : jd.tailored ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-800/50">
          <div className="flex flex-wrap gap-2">
            {pdf && <DownloadButton file={pdf} label="Download PDF" primary />}
            {docx && <DownloadButton file={docx} label="Download Word" />}
          </div>
          <MatchSummary tailored={jd.tailored} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-800/50 dark:text-neutral-300">
          <span>Your resume isn&apos;t tailored to this JD yet.</span>
          <Button type="button" size="sm" onClick={onTailor}>
            Tailor my resume
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <LinkButton onClick={() => toggle("jd")} expanded={panel === "jd"}>
          {panel === "jd" ? "Hide JD" : "View JD"}
        </LinkButton>
        <LinkButton onClick={() => toggle("edit")} expanded={panel === "edit"}>
          Edit details
        </LinkButton>
        {jd.tailored && !tailoring && (
          <button type="button" onClick={onTailor} className="font-medium text-brand-600 hover:underline dark:text-brand-400" title="Run again, e.g. after updating your resume">
            Tailor again
          </button>
        )}
        {jd.submissionId && (
          <Link href="/dashboard/spreadsheet" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            In Spreadsheet
          </Link>
        )}
        <button type="button" onClick={onDelete} className="font-medium text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400">
          Delete
        </button>
      </div>

      {panel === "jd" && (
        <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-200">
          {jd.jobDescription}
          {jd.notes && (
            <p className="mt-4 border-t border-neutral-200 pt-3 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <span className="font-semibold">Notes:</span> {jd.notes}
            </p>
          )}
        </div>
      )}

      {panel === "edit" && (
        <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <EditJd jd={jd} onCancel={() => onPanel(null)} onSaved={onEdited} onUnauthorized={onUnauthorized} />
        </div>
      )}

      {panel === "send" && jd.tailored && (
        <SendPanel jd={jd} user={user} canSendEmail={canSendEmail} onCancel={() => onPanel(null)} onSent={onSent} onUnauthorized={onUnauthorized} />
      )}
    </li>
  );
}

function StatusPill({ jd, tailoring }: { jd: VendorJd; tailoring: boolean }) {
  const status = tailoring ? "working" : statusOf(jd);
  const style = {
    working: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200",
    tailor: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    send: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  }[status];
  const label = {
    working: "Tailoring…",
    tailor: "Not tailored",
    send: "Ready to send",
    sent: `Sent ${jd.sentAt ? shortDate(jd.sentAt) : ""}${jd.sentTo ? ` to ${jd.sentTo}` : ""}`,
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style}`}>{label}</span>;
}

function MatchSummary({ tailored }: { tailored: NonNullable<VendorJd["tailored"]> }) {
  const percent = tailored.finalMatchPercent;
  const missing = tailored.missingKeywords.slice(0, 4);
  return (
    <div className="text-xs text-neutral-500 sm:text-right dark:text-neutral-400">
      {typeof percent === "number" && (
        <p>
          <span className="font-semibold text-neutral-800 dark:text-neutral-100">{Math.round(percent)}% keyword match</span> · tailored{" "}
          {shortDate(tailored.createdAt)}
        </p>
      )}
      {missing.length > 0 && (
        <p className="mt-0.5">
          Not on your resume: {missing.join(", ")}
          {tailored.missingKeywords.length > missing.length && ` +${tailored.missingKeywords.length - missing.length}`}
        </p>
      )}
    </div>
  );
}

function DownloadButton({ file, label, primary = false }: { file: GeneratedFile; label: string; primary?: boolean }) {
  return (
    <a
      href={file.downloadUrl}
      download={file.fileName}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
        primary
          ? "bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700"
          : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-neutral-800"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      {label}
    </a>
  );
}

function LinkButton({ onClick, expanded, children }: { onClick: () => void; expanded: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
      {children}
    </button>
  );
}

/* ---------- edit ---------- */

function EditJd({ jd, onCancel, onSaved, onUnauthorized }: { jd: VendorJd; onCancel: () => void; onSaved: (jd: VendorJd) => void; onUnauthorized: () => void }) {
  const [values, setValues] = useState<VendorJdFields>(() => {
    const { title, client, location, rate, vendorCompany, vendorContact, vendorEmail, notes } = jd;
    return { title, client, location, rate, vendorCompany, vendorContact, vendorEmail, notes };
  });
  const [description, setDescription] = useState(jd.jobDescription);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof VendorJdFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((all) => without(all, key));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = description.trim();
    const problems: Record<string, string> = {};
    if (text.length < VENDOR_JD_MIN_CHARS) problems.jobDescription = `Paste the full job description (at least ${VENDOR_JD_MIN_CHARS} characters).`;
    if (!values.title.trim()) problems.title = "Give the role a name";
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    const result = await updateVendorJd(jd.id, { ...values, jobDescription: text });
    setSaving(false);
    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (isUnauthorized(code)) return onUnauthorized();
      if (fieldErrors && Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setError(message);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Role" value={values.title} onChange={set("title")} error={errors.title} disabled={saving} />
        <TextField label="Client" value={values.client} onChange={set("client")} error={errors.client} disabled={saving} />
        <TextField label="Location" value={values.location} onChange={set("location")} error={errors.location} disabled={saving} />
        <TextField label="Rate" value={values.rate} onChange={set("rate")} error={errors.rate} disabled={saving} />
        <TextField label="Vendor company" value={values.vendorCompany} onChange={set("vendorCompany")} error={errors.vendorCompany} disabled={saving} />
        <TextField label="Vendor contact" value={values.vendorContact} onChange={set("vendorContact")} error={errors.vendorContact} disabled={saving} />
        <TextField
          label="Vendor email"
          type="email"
          value={values.vendorEmail}
          onChange={set("vendorEmail")}
          error={errors.vendorEmail}
          className="sm:col-span-2"
          disabled={saving}
        />
      </div>
      <TextArea
        label="Job description"
        rows={8}
        maxLength={VENDOR_JD_MAX_CHARS}
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          if (errors.jobDescription) setErrors((all) => without(all, "jobDescription"));
        }}
        error={errors.jobDescription}
        hint={jd.tailored ? "Changing the description tailors your resume again." : undefined}
        disabled={saving}
      />
      <TextArea label="Notes (only you see these)" rows={2} value={values.notes} onChange={set("notes")} error={errors.notes} disabled={saving} />
      <div className="flex items-center justify-end gap-3">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/* ---------- send to the vendor ---------- */

function defaultMessage(jd: VendorJd, user: User | null): string {
  const first = jd.vendorContact.trim().split(/\s+/)[0];
  const role = jd.client ? `${jd.title} role with ${jd.client}` : `${jd.title} role`;
  const signature = [user?.name, user?.email, user?.phone].filter(Boolean).join("\n");
  return `Hi ${first || "there"},\n\nThank you for sharing the ${role}. I'm interested, and I've attached my updated resume for your review.\n\nPlease let me know the next steps.\n\nThanks,\n${signature}`;
}

function SendPanel({
  jd,
  user,
  canSendEmail,
  onCancel,
  onSent,
  onUnauthorized,
}: {
  jd: VendorJd;
  user: User | null;
  canSendEmail: boolean;
  onCancel: () => void;
  onSent: (jd: VendorJd, message: string) => void;
  onUnauthorized: () => void;
}) {
  const files = jd.tailored?.files ?? [];
  const [to, setTo] = useState(jd.sentTo || jd.vendorEmail);
  const [subject, setSubject] = useState(`Resume for ${jd.title}${user?.name ? ` | ${user.name}` : ""}`);
  const [body, setBody] = useState(() => defaultMessage(jd, user));
  const [attach, setAttach] = useState<string[]>(() => {
    const pdf = files.find((f) => f.format === "pdf") ?? files[0];
    return pdf ? [pdf.id] : [];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "mark" | null>(null);

  const pdf = files.find((f) => f.format === "pdf");
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function send(mode: "email" | "mark") {
    setError(null);
    setErrors({});
    setBusy(mode);
    const result = await sendVendorJd(jd.id, mode === "email" ? { mode, to, subject, body, fileIds: attach } : { mode, to });
    setBusy(null);
    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (isUnauthorized(code)) return onUnauthorized();
      if (fieldErrors && Object.keys(fieldErrors).length) setErrors(fieldErrors);
      setError(fieldErrors?.fileIds ?? message);
      return;
    }
    onSent(
      result.data,
      mode === "email"
        ? `Sent to ${to}. It's in your Inbox's sent mail, and a row was added to your Spreadsheet.`
        : `Marked as sent${to ? ` to ${to}` : ""}. A row was added to your Spreadsheet.`,
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="To" type="email" value={to} onChange={(e) => setTo(e.target.value)} error={errors.to} placeholder="name@vendor.com" disabled={!!busy} />
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} disabled={!!busy} />
      </div>
      <TextArea label="Message" rows={8} value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} disabled={!!busy} />

      {canSendEmail ? (
        <>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">Attach</legend>
            <div className="flex flex-wrap gap-4">
              {files.map((f) => (
                <label key={f.id} className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    checked={attach.includes(f.id)}
                    onChange={(e) => setAttach((a) => (e.target.checked ? [...a, f.id] : a.filter((x) => x !== f.id)))}
                    disabled={!!busy}
                  />
                  {f.fileName} <span className="text-xs text-neutral-400 uppercase">{f.format}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => send("mark")}
              disabled={!!busy}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50 dark:hover:text-neutral-200"
            >
              {busy === "mark" ? "Saving…" : "I sent it myself"}
            </button>
            <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={!!busy}>
              Cancel
            </Button>
            <Button type="button" size="sm" loading={busy === "email"} disabled={!!busy && busy !== "email"} onClick={() => send("email")}>
              Send email
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-300">
            Sending straight from the site isn&apos;t switched on yet. Download your PDF, open the email in your own email app and attach it, then
            click <span className="font-semibold">Mark as sent</span> so it&apos;s tracked in your Spreadsheet.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={!!busy}>
              Cancel
            </Button>
            {pdf && <DownloadButton file={pdf} label="1 · Download PDF" />}
            <a
              href={mailto}
              className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              2 · Open in email app
            </a>
            <Button type="button" size="sm" loading={busy === "mark"} onClick={() => send("mark")}>
              3 · Mark as sent
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
