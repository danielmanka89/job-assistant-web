"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, GeneratedFile, SaveVendorJdRequest, User, VendorJd, VendorJdFields } from "@/lib/types";
import { VENDOR_JD_MAX_CHARS, VENDOR_JD_MIN_CHARS } from "@/lib/types";
import { createVendorJd, deleteVendorJd, listVendorJds, logout, sendVendorJd, updateVendorJd } from "@/lib/client/api";
import { clearTailoringJd, readTailoringJd, storePendingJob, storeTailoringJd } from "@/lib/client/jobs";
import { useCurrentUser } from "@/lib/client/current-user";
import { Button } from "@/components/ui/button";
import { ErrorAlert, SuccessAlert } from "@/components/ui/alert";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

type Filter = "all" | "tailor" | "send" | "sent";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tailor", label: "To tailor" },
  { key: "send", label: "Ready to send" },
  { key: "sent", label: "Sent" },
];

const statusOf = (jd: VendorJd): Exclude<Filter, "all"> => (jd.sentAt ? "sent" : jd.tailored ? "send" : "tailor");

const EMPTY: VendorJdFields = { title: "", client: "", location: "", rate: "", vendorCompany: "", vendorContact: "", vendorEmail: "", notes: "" };

const CARD = "rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function JdsView({ initialSendId }: { initialSendId: string | null }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [jds, setJds] = useState<VendorJd[] | null>(null);
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<{ id: string; panel: "jd" | "edit" | "send" } | null>(
    initialSendId ? { id: initialSendId, panel: "send" } : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  async function onUnauthorized() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    let live = true;
    listVendorJds().then(async (result) => {
      if (!live) return;
      if (!result.ok) {
        if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") return onUnauthorized();
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

  // Back from tailoring: that JD's Send panel is open, so the "tailoring" note has done its job.
  useEffect(() => {
    if (initialSendId && readTailoringJd() === initialSendId) clearTailoringJd();
  }, [initialSendId]);

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

  function onTailor(jd: VendorJd) {
    storePendingJob({ id: `jd:${jd.id}`, title: jd.title, company: jd.client || jd.vendorCompany, description: jd.jobDescription, source: "jd" });
    storeTailoringJd(jd.id);
    router.push("/dashboard/analyze");
  }

  async function onDelete(jd: VendorJd) {
    if (!window.confirm(`Delete "${jd.title}"? Its tailored resume and Spreadsheet row stay.`)) return;
    const result = await deleteVendorJd(jd.id);
    if (!result.ok) {
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") return onUnauthorized();
      setNotice(null);
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
        <section aria-labelledby="add-jd" className={`${CARD} p-5 sm:p-6`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="add-jd" className="text-base font-semibold text-neutral-900 dark:text-white">
                Add a JD
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Paste what the vendor sent. Only the description is required.</p>
            </div>
            {jds.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                Cancel
              </button>
            )}
          </div>
          <JdForm
            submitLabel="Save JD"
            onUnauthorized={onUnauthorized}
            onSave={(values) => createVendorJd(values)}
            onSaved={(jd) => {
              setJds((list) => [jd, ...(list ?? [])]);
              setAdding(false);
              setFilter("all");
              setNotice(`Saved "${jd.title}". Click Tailor resume when you're ready.`);
            }}
          />
        </section>
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
            <Button type="button" size="sm" onClick={() => { setAdding(true); setNotice(null); }} className="shrink-0">
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
            panel={openId?.id === jd.id ? openId.panel : null}
            onPanel={(panel) => setOpenId(panel ? { id: jd.id, panel } : null)}
            onTailor={() => onTailor(jd)}
            onDelete={() => onDelete(jd)}
            onChanged={(next, message) => {
              replace(next);
              setOpenId(null);
              if (message) setNotice(message);
            }}
            onUnauthorized={onUnauthorized}
          />
        ))}
      </ul>
    </div>
  );
}

/* ---------- one JD ---------- */

type RowProps = {
  jd: VendorJd;
  user: User | null;
  canSendEmail: boolean;
  panel: "jd" | "edit" | "send" | null;
  onPanel: (panel: "jd" | "edit" | "send" | null) => void;
  onTailor: () => void;
  onDelete: () => void;
  onChanged: (jd: VendorJd, message?: string) => void;
  onUnauthorized: () => void;
};

function JdRow({ jd, user, canSendEmail, panel, onPanel, onTailor, onDelete, onChanged, onUnauthorized }: RowProps) {
  const ref = useRef<HTMLLIElement>(null);
  const status = statusOf(jd);
  const pdf = jd.tailored?.files.find((f) => f.format === "pdf");
  const docx = jd.tailored?.files.find((f) => f.format === "docx");
  const facts = [jd.client, jd.location, jd.rate].filter(Boolean);
  const vendor = [jd.vendorCompany, jd.vendorContact].filter(Boolean).join(" · ");

  // Opened from a link (?send=…): bring it into view.
  const scrolled = useRef(false);
  useEffect(() => {
    if (panel === "send" && !scrolled.current) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      scrolled.current = true;
    }
  }, [panel]);

  const toggle = (p: "jd" | "edit" | "send") => onPanel(panel === p ? null : p);

  return (
    <li ref={ref} className={`${CARD} scroll-mt-24 p-4 sm:p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{jd.title}</h3>
            <StatusPill jd={jd} />
          </div>
          {facts.length > 0 && <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">{facts.join(" · ")}</p>}
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {vendor ? `From ${vendor}` : "Vendor not added"}
            {jd.vendorEmail && ` · ${jd.vendorEmail}`} · Saved {shortDate(jd.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status === "send" && (
            <Button type="button" size="sm" onClick={() => toggle("send")} aria-expanded={panel === "send"}>
              Send to vendor
            </Button>
          )}
          <Button type="button" size="sm" variant={status === "tailor" ? "primary" : "secondary"} onClick={onTailor}>
            {jd.tailored ? "Tailor again" : "Tailor resume"}
          </Button>
          {status === "sent" && (
            <Button type="button" size="sm" variant="secondary" onClick={() => toggle("send")} aria-expanded={panel === "send"}>
              Send again
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <LinkButton onClick={() => toggle("jd")} expanded={panel === "jd"}>
          {panel === "jd" ? "Hide JD" : "View JD"}
        </LinkButton>
        <LinkButton onClick={() => toggle("edit")} expanded={panel === "edit"}>
          Edit details
        </LinkButton>
        {pdf && <FileLink file={pdf} label="PDF" />}
        {docx && <FileLink file={docx} label="Word" />}
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
          <JdForm
            initial={jd}
            submitLabel="Save changes"
            onCancel={() => onPanel(null)}
            onUnauthorized={onUnauthorized}
            onSave={(values) => updateVendorJd(jd.id, values)}
            onSaved={(next) => onChanged(next, "Changes saved.")}
          />
          {jd.tailored && (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Changing the description unlinks the tailored resume, so you&apos;d tailor it again.
            </p>
          )}
        </div>
      )}

      {panel === "send" &&
        (jd.tailored ? (
          <SendPanel
            jd={jd}
            user={user}
            canSendEmail={canSendEmail}
            onCancel={() => onPanel(null)}
            onSent={onChanged}
            onUnauthorized={onUnauthorized}
          />
        ) : (
          <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-300">
            Tailor your resume to this JD first, then send it from here.{" "}
            <button type="button" onClick={onTailor} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Tailor resume
            </button>
          </div>
        ))}
    </li>
  );
}

function StatusPill({ jd }: { jd: VendorJd }) {
  const status = statusOf(jd);
  const style = {
    tailor: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    send: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  }[status];
  const percent = jd.tailored?.finalMatchPercent;
  const label =
    status === "sent"
      ? `Sent ${shortDate(jd.sentAt!)}${jd.sentTo ? ` to ${jd.sentTo}` : ""}`
      : status === "send"
        ? `Tailored${typeof percent === "number" ? ` · ${Math.round(percent)}% match` : ""}`
        : "Not tailored yet";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style}`}>{label}</span>;
}

function LinkButton({ onClick, expanded, children }: { onClick: () => void; expanded: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
      {children}
    </button>
  );
}

function FileLink({ file, label }: { file: GeneratedFile; label: string }) {
  return (
    <a href={file.downloadUrl} download={file.fileName} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400">
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      {label}
    </a>
  );
}

/* ---------- add / edit ---------- */

type Result = { ok: true; data: VendorJd } | { ok: false; error: ApiError };

function JdForm({
  initial,
  submitLabel,
  onSave,
  onSaved,
  onCancel,
  onUnauthorized,
}: {
  initial?: VendorJd;
  submitLabel: string;
  onSave: (values: SaveVendorJdRequest) => Promise<Result>;
  onSaved: (jd: VendorJd) => void;
  onCancel?: () => void;
  onUnauthorized: () => void;
}) {
  const [values, setValues] = useState<VendorJdFields>(() => (initial ? pickFields(initial) : EMPTY));
  const [description, setDescription] = useState(initial?.jobDescription ?? "");
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
    if (text.length < VENDOR_JD_MIN_CHARS) {
      setErrors({ jobDescription: text ? `That looks too short. Paste the full job description (at least ${VENDOR_JD_MIN_CHARS} characters).` : "Paste the job description" });
      return;
    }
    if (initial && !values.title.trim()) {
      setErrors({ title: "Give the role a name" });
      return;
    }
    setSaving(true);
    const result = await onSave({ ...values, jobDescription: text });
    setSaving(false);
    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") return onUnauthorized();
      if (fieldErrors && Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setError(message);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <TextArea
        label="Job description"
        rows={initial ? 8 : 9}
        maxLength={VENDOR_JD_MAX_CHARS}
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          if (errors.jobDescription) setErrors((all) => without(all, "jobDescription"));
        }}
        placeholder="Paste the JD from the vendor's email: role, responsibilities, must-have skills…"
        error={errors.jobDescription}
        disabled={saving}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Role" value={values.title} onChange={set("title")} error={errors.title} placeholder={initial ? "" : "Read from the JD if blank"} disabled={saving} />
        <TextField label="Client" value={values.client} onChange={set("client")} error={errors.client} placeholder="e.g. Capital One" disabled={saving} />
        <TextField label="Location" value={values.location} onChange={set("location")} error={errors.location} placeholder="e.g. Remote / Dallas, TX" disabled={saving} />
        <TextField label="Rate" value={values.rate} onChange={set("rate")} error={errors.rate} placeholder="e.g. $65/hr C2C" disabled={saving} />
        <TextField label="Vendor company" value={values.vendorCompany} onChange={set("vendorCompany")} error={errors.vendorCompany} disabled={saving} />
        <TextField label="Vendor contact" value={values.vendorContact} onChange={set("vendorContact")} error={errors.vendorContact} placeholder="Recruiter's name" disabled={saving} />
        <TextField
          label="Vendor email"
          type="email"
          value={values.vendorEmail}
          onChange={set("vendorEmail")}
          error={errors.vendorEmail}
          placeholder="name@vendor.com"
          className="sm:col-span-2"
          disabled={saving}
        />
      </div>
      <TextArea label="Notes (only you see these)" rows={2} value={values.notes} onChange={set("notes")} error={errors.notes} disabled={saving} />
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function without(all: Record<string, string>, key: string): Record<string, string> {
  const next = { ...all };
  delete next[key];
  return next;
}

function pickFields(jd: VendorJd): VendorJdFields {
  const { title, client, location, rate, vendorCompany, vendorContact, vendorEmail, notes } = jd;
  return { title, client, location, rate, vendorCompany, vendorContact, vendorEmail, notes };
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
      if (code === "UNAUTHORIZED" || code === "HTTP_401") return onUnauthorized();
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
            <button type="button" onClick={() => send("mark")} disabled={!!busy} className="text-sm font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-50 dark:hover:text-neutral-200">
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
            {pdf && (
              <a
                href={pdf.downloadUrl}
                download={pdf.fileName}
                className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                1 · Download PDF
              </a>
            )}
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
