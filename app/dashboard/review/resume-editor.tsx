"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Education, Resume, ResumeContact, WorkExperience } from "@/lib/types";
import { logout, saveResume } from "@/lib/client/api";
import { storeResume } from "@/lib/client/resume-storage";
import { TextField } from "@/components/ui/text-field";
import { TextArea } from "@/components/ui/text-area";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { AddButton, Checkbox, EmptyHint, ItemCard, Section, SkillsInput } from "./form-parts";
import {
  emptyBullet,
  emptyEducation,
  emptyWorkExperience,
  mapServerFieldErrors,
  normalizeResume,
  validateResume,
  withoutErrors,
  type FormErrors,
} from "./resume-form";

const MAX_TEXT = 2000;

type Status = "idle" | "saving" | "saved";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SECTION_ICONS = {
  contact: icon("M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0"),
  experience: icon(
    "M20.25 14.15v4.1a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-4.1M16.5 6.75V5.25A2.25 2.25 0 0 0 14.25 3h-4.5A2.25 2.25 0 0 0 7.5 5.25v1.5m-3.75 0h16.5v4.5a9 9 0 0 1-16.5 0v-4.5Z",
  ),
  education: icon(
    "M4.26 10.15A50.6 50.6 0 0 0 2.66 15.8 60.4 60.4 0 0 1 12 20.9a60.4 60.4 0 0 1 9.34-5.1 50.6 50.6 0 0 0-1.6-5.65M4.26 10.15 12 5.25l7.74 4.9M4.26 10.15 12 15l7.74-4.85M6.75 15v-3.4",
  ),
  skills: icon(
    "M9.8 15.9 9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.1L2.25 12l2.85-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.1l2.85.8-2.85.8a4.5 4.5 0 0 0-3.1 3.1ZM18.26 8.7 18 9.75l-.26-1.04a3.4 3.4 0 0 0-2.45-2.46L14.25 6l1.04-.26a3.4 3.4 0 0 0 2.45-2.45L18 2.25l.26 1.04a3.4 3.4 0 0 0 2.46 2.45l1.03.26-1.03.26a3.4 3.4 0 0 0-2.46 2.45Z",
  ),
};

export function ResumeEditor({ initial }: { initial: Resume }) {
  const [resume, setResume] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const router = useRouter();

  // Client errors show only after the first save attempt, then update live as fields are fixed.
  // Server errors stay until the field they belong to is edited.
  const errors: FormErrors = { ...serverErrors, ...(submitted ? validateResume(resume) : {}) };
  const errorCount = Object.keys(errors).length;

  // Move focus to the first invalid field once the errors have rendered.
  useEffect(() => {
    if (focusRequest === 0) return;
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.focus({ preventScroll: true });
  }, [focusRequest]);

  /** Applies an edit and clears server errors under the given field paths. */
  function update(fn: (r: Resume) => Resume, clear: string[]) {
    setResume(fn);
    setDirty(true);
    setServerErrors((e) => withoutErrors(e, clear));
    if (status === "saved") setStatus("idle");
  }

  const setContact = (field: keyof ResumeContact, value: string) =>
    update((r) => ({ ...r, contact: { ...r.contact, [field]: value } }), [`contact.${field}`]);

  const setWork = (index: number, changes: Partial<WorkExperience>) =>
    update(
      (r) => ({
        ...r,
        workExperience: r.workExperience.map((w, i) => (i === index ? { ...w, ...changes } : w)),
      }),
      Object.keys(changes).map((k) => `workExperience.${index}.${k}`),
    );

  const setEducation = (index: number, changes: Partial<Education>) =>
    update(
      (r) => ({ ...r, education: r.education.map((e, i) => (i === index ? { ...e, ...changes } : e)) }),
      Object.keys(changes).map((k) => `education.${index}.${k}`),
    );

  async function onSave() {
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(validateResume(resume)).length > 0) {
      setFocusRequest((n) => n + 1);
      return;
    }

    setStatus("saving");
    const payload = normalizeResume(resume);
    const result = await saveResume(payload);

    if (!result.ok) {
      setStatus("idle");
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      // The server checked the cleaned-up payload, so show the form in that same shape.
      setResume(payload);
      const { fieldErrors, other } = mapServerFieldErrors(result.error.fieldErrors ?? {}, payload);
      setServerErrors(fieldErrors);
      setSaveError(
        other.length > 0
          ? `${result.error.message} (${other.join("; ")})`
          : Object.keys(fieldErrors).length > 0
            ? null
            : result.error.message,
      );
      setFocusRequest((n) => n + 1);
      return;
    }

    setResume(result.data);
    storeResume(result.data);
    setServerErrors({});
    setDirty(false);
    setSubmitted(false);
    setStatus("saved");
    router.push("/dashboard/analyze");
  }

  const sections = [
    { id: "contact", label: "Contact" },
    { id: "experience", label: "Experience", count: resume.workExperience.length },
    { id: "education", label: "Education", count: resume.education.length },
    { id: "skills", label: "Skills", count: resume.skills.length },
  ];

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved"
        : errorCount > 0
          ? `Fix ${errorCount} ${errorCount === 1 ? "field" : "fields"} to continue`
          : dirty
            ? "You have unsaved changes"
            : "Review each section, then save";

  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Resume sections" className="hidden lg:block">
        <ul className="sticky top-28 space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                {s.label}
                {s.count !== undefined && (
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {s.count}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Locked while saving: the saved version replaces the form, so edits made meanwhile would be lost. */}
      <fieldset disabled={status === "saving"} className="m-0 min-w-0 space-y-6 border-0 p-0 pb-36">
        {status === "saved" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold">Resume saved</p>
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-300/80">
                Your details are up to date. Next, you&apos;ll paste the job description you&apos;re applying for.
              </p>
            </div>
          </div>
        )}
        {saveError && <ErrorAlert>{saveError}</ErrorAlert>}

        <Section
          id="contact"
          title="Contact details"
          description="Shown at the top of your resume."
          icon={SECTION_ICONS.contact}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Full name"
              autoComplete="name"
              value={resume.contact.fullName}
              onChange={(e) => setContact("fullName", e.target.value)}
              error={errors["contact.fullName"]}
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={resume.contact.email}
              onChange={(e) => setContact("email", e.target.value)}
              error={errors["contact.email"]}
            />
            <TextField
              label="Phone (optional)"
              type="tel"
              autoComplete="tel"
              placeholder="+49 30 1234567"
              value={resume.contact.phone ?? ""}
              onChange={(e) => setContact("phone", e.target.value)}
              error={errors["contact.phone"]}
            />
            <TextField
              label="Location (optional)"
              placeholder="Berlin, Germany"
              value={resume.contact.location ?? ""}
              onChange={(e) => setContact("location", e.target.value)}
              error={errors["contact.location"]}
            />
            <TextField
              label="LinkedIn (optional)"
              type="url"
              placeholder="linkedin.com/in/you"
              value={resume.contact.linkedinUrl ?? ""}
              onChange={(e) => setContact("linkedinUrl", e.target.value)}
              error={errors["contact.linkedinUrl"]}
            />
            <TextField
              label="Website (optional)"
              type="url"
              placeholder="yoursite.com"
              value={resume.contact.websiteUrl ?? ""}
              onChange={(e) => setContact("websiteUrl", e.target.value)}
              error={errors["contact.websiteUrl"]}
            />
            <TextArea
              className="sm:col-span-2"
              label="Professional summary (optional)"
              rows={4}
              placeholder="Two or three sentences about your experience and what you're good at."
              value={resume.summary ?? ""}
              onChange={(e) => update((r) => ({ ...r, summary: e.target.value }), ["summary"])}
              error={errors.summary}
              maxLength={MAX_TEXT}
            />
          </div>
        </Section>

        <Section
          id="experience"
          title="Work experience"
          description="Most recent first. Use the arrows to reorder."
          icon={SECTION_ICONS.experience}
          action={
            <AddButton
              onClick={() => update((r) => ({ ...r, workExperience: [...r.workExperience, emptyWorkExperience()] }), [])}
            >
              Add role
            </AddButton>
          }
        >
          {resume.workExperience.length === 0 ? (
            <EmptyHint>No roles yet. Click &ldquo;Add role&rdquo; to add your first job.</EmptyHint>
          ) : (
            <div className="space-y-4">
              {resume.workExperience.map((work, i) => {
                const p = `workExperience.${i}`;
                const current = work.endDate === null;
                return (
                  <ItemCard
                    key={work.id}
                    kind="role"
                    index={i}
                    count={resume.workExperience.length}
                    title={work.jobTitle.trim() || "New role"}
                    subtitle={work.company.trim() || undefined}
                    onMove={(to) => update((r) => ({ ...r, workExperience: move(r.workExperience, i, to) }), ["workExperience"])}
                    onRemove={() =>
                      update((r) => ({ ...r, workExperience: r.workExperience.filter((w) => w.id !== work.id) }), ["workExperience"])
                    }
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        label="Job title"
                        placeholder="Frontend Engineer"
                        value={work.jobTitle}
                        onChange={(e) => setWork(i, { jobTitle: e.target.value })}
                        error={errors[`${p}.jobTitle`]}
                      />
                      <TextField
                        label="Company"
                        placeholder="Acme GmbH"
                        value={work.company}
                        onChange={(e) => setWork(i, { company: e.target.value })}
                        error={errors[`${p}.company`]}
                      />
                      <TextField
                        className="sm:col-span-2"
                        label="Location (optional)"
                        placeholder="Berlin, Germany"
                        value={work.location ?? ""}
                        onChange={(e) => setWork(i, { location: e.target.value })}
                        error={errors[`${p}.location`]}
                      />
                      <TextField
                        label="Start date"
                        type="month"
                        placeholder="YYYY-MM"
                        value={work.startDate}
                        onChange={(e) => setWork(i, { startDate: e.target.value })}
                        error={errors[`${p}.startDate`]}
                      />
                      <div>
                        <TextField
                          label="End date"
                          type={current ? "text" : "month"}
                          placeholder="YYYY-MM"
                          value={current ? "Present" : (work.endDate ?? "")}
                          disabled={current}
                          onChange={(e) => setWork(i, { endDate: e.target.value })}
                          error={errors[`${p}.endDate`]}
                        />
                        <div className="mt-2.5">
                          <Checkbox
                            label="I currently work here"
                            checked={current}
                            onChange={(checked) => setWork(i, { endDate: checked ? null : "" })}
                          />
                        </div>
                      </div>
                    </div>

                    <fieldset className="mt-6">
                      <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Achievements
                      </legend>
                      <div className="space-y-2.5">
                        {work.bullets.map((bullet, j) => (
                          <div key={bullet.id} className="flex items-start gap-2">
                            <span className="mt-[1.15rem] size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                            <TextArea
                              className="flex-1"
                              label={`Achievement ${j + 1}`}
                              hideLabel
                              rows={2}
                              placeholder="What did you do, and what changed because of it?"
                              maxLength={MAX_TEXT}
                              error={errors[`${p}.bullets.${bullet.id}`]}
                              value={bullet.text}
                              onChange={(e) =>
                                setWork(i, {
                                  bullets: work.bullets.map((b) =>
                                    b.id === bullet.id ? { ...b, text: e.target.value } : b,
                                  ),
                                })
                              }
                            />
                            <div className="pt-1.5">
                              <button
                                type="button"
                                aria-label={`Remove achievement ${j + 1}`}
                                title="Remove"
                                onClick={() => setWork(i, { bullets: work.bullets.filter((b) => b.id !== bullet.id) })}
                                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setWork(i, { bullets: [...work.bullets, emptyBullet()] })}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                        </svg>
                        Add achievement
                      </button>
                    </fieldset>
                  </ItemCard>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          id="education"
          title="Education"
          description="Degrees, diplomas and certifications."
          icon={SECTION_ICONS.education}
          action={
            <AddButton onClick={() => update((r) => ({ ...r, education: [...r.education, emptyEducation()] }), [])}>
              Add education
            </AddButton>
          }
        >
          {resume.education.length === 0 ? (
            <EmptyHint>No education added yet.</EmptyHint>
          ) : (
            <div className="space-y-4">
              {resume.education.map((edu, i) => {
                const p = `education.${i}`;
                const inProgress = edu.endDate === null;
                return (
                  <ItemCard
                    key={edu.id}
                    kind="education entry"
                    index={i}
                    count={resume.education.length}
                    title={edu.institution.trim() || "New education"}
                    subtitle={[edu.degree, edu.fieldOfStudy].filter((v) => v?.trim()).join(", ") || undefined}
                    onMove={(to) => update((r) => ({ ...r, education: move(r.education, i, to) }), ["education"])}
                    onRemove={() => update((r) => ({ ...r, education: r.education.filter((e) => e.id !== edu.id) }), ["education"])}
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        className="sm:col-span-2"
                        label="School or university"
                        placeholder="TU Berlin"
                        value={edu.institution}
                        onChange={(e) => setEducation(i, { institution: e.target.value })}
                        error={errors[`${p}.institution`]}
                      />
                      <TextField
                        label="Degree"
                        placeholder="B.Sc."
                        value={edu.degree}
                        onChange={(e) => setEducation(i, { degree: e.target.value })}
                        error={errors[`${p}.degree`]}
                      />
                      <TextField
                        label="Field of study (optional)"
                        placeholder="Computer Science"
                        value={edu.fieldOfStudy ?? ""}
                        onChange={(e) => setEducation(i, { fieldOfStudy: e.target.value })}
                        error={errors[`${p}.fieldOfStudy`]}
                      />
                      <TextField
                        label="Start date (optional)"
                        type="month"
                        placeholder="YYYY-MM"
                        value={edu.startDate ?? ""}
                        onChange={(e) => setEducation(i, { startDate: e.target.value })}
                        error={errors[`${p}.startDate`]}
                      />
                      <div>
                        <TextField
                          label="End date (optional)"
                          type={inProgress ? "text" : "month"}
                          placeholder="YYYY-MM"
                          value={inProgress ? "In progress" : (edu.endDate ?? "")}
                          disabled={inProgress}
                          onChange={(e) => setEducation(i, { endDate: e.target.value })}
                          error={errors[`${p}.endDate`]}
                        />
                        <div className="mt-2.5">
                          <Checkbox
                            label="I'm still studying here"
                            checked={inProgress}
                            onChange={(checked) => setEducation(i, { endDate: checked ? null : "" })}
                          />
                        </div>
                      </div>
                    </div>
                  </ItemCard>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          id="skills"
          title="Skills"
          description="Tools, languages and strengths we should match against job descriptions."
          icon={SECTION_ICONS.skills}
        >
          <SkillsInput skills={resume.skills} error={errors.skills} onChange={(skills) => update((r) => ({ ...r, skills }), ["skills"])} />
        </Section>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p
            aria-live="polite"
            className={`hidden text-sm font-medium sm:block ${
              status === "saved"
                ? "text-emerald-600 dark:text-emerald-400"
                : errorCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {statusText}
          </p>
          <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2.5 text-[15px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Back
            </Link>
            <Button type="button" loading={status === "saving"} onClick={onSave} className="min-w-44">
              {status === "saving" ? "Saving…" : "Save & Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
