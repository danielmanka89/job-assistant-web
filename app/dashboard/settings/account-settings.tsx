"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CLOCK_TEMPLATES, type ApiError, type ThemeColor, type ClockTemplate, type UpdateAccountRequest, type User } from "@/lib/types";
import { getAccount, logout, removeAvatarPhoto, removeProfilePhoto, updateAccount, uploadAvatarPhoto, uploadProfilePhoto } from "@/lib/client/api";
import { loadPhoto, type PreparedPhoto } from "@/lib/client/photo-crop";
import { PhotoCropDialog } from "./photo-crop-dialog";
import { Avatar } from "@/components/ui/avatar";
import { storeUser } from "@/lib/client/current-user";
import { hasErrors, splitApiError, validateEmail, validatePassword, type FieldErrors } from "@/lib/client/forms";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ThemePicker } from "@/components/theme-toggle";
import { THEME_COLOR_LABEL, CLOCK_TEMPLATE_LABEL, UsClocks } from "@/components/dashboard/us-clocks";

type Load = { status: "loading" } | { status: "ready"; user: User } | { status: "error"; message: string };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

/** Loads the account from the API, then shows the profile and password forms. */
export function AccountSettings() {
  const router = useRouter();
  const [state, setState] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getAccount().then(async (result) => {
      if (!active) return;
      if (!result.ok && isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setState(result.ok ? { status: "ready", user: result.data.user } : { status: "error", message: result.error.message });
    });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  // Keeps the sidebar and the stored user in step with what the API saved.
  function onSaved(user: User) {
    storeUser(user);
    setState({ status: "ready", user });
  }

  async function onUnauthorized() {
    await logout();
    router.replace("/login");
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <ErrorAlert>{state.message}</ErrorAlert>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppearanceCard />
      <ThemeColorForm user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      <PhotoForm kind="menu" user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      <PhotoForm kind="portfolio" user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      <ProfileForm user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      <PasswordForm email={state.user.email} onUnauthorized={onUnauthorized} />
      <ClockTemplateForm user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
    </div>
  );
}

/* ---------- Profile ---------- */

type ProfileValues = { name: string; email: string; currentPassword: string };
const PROFILE_FIELDS = ["name", "email", "currentPassword"] as const;

function ProfileForm({
  user,
  onSaved,
  onUnauthorized,
}: {
  user: User;
  onSaved: (user: User) => void;
  onUnauthorized: () => void;
}) {
  const [values, setValues] = useState<ProfileValues>({ name: user.name, email: user.email, currentPassword: "" });
  const [errors, setErrors] = useState<FieldErrors<ProfileValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const feedbackRef = useRevealFeedback(success || formError);

  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const nameChanged = name !== user.name;
  const emailChanged = email !== user.email;

  function update(field: keyof ProfileValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setSuccess(null);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const clientErrors: FieldErrors<ProfileValues> = {
      name: name ? (name.length > 100 ? "Use 100 characters or fewer." : undefined) : "Enter your name.",
      email: validateEmail(values.email),
      currentPassword: emailChanged && !values.currentPassword ? "Enter your current password to change your email." : undefined,
    };
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return focusFirstError();

    const request: UpdateAccountRequest = {
      ...(nameChanged ? { name } : {}),
      ...(emailChanged ? { email, currentPassword: values.currentPassword } : {}),
    };
    setPending(true);
    const result = await updateAccount(request);
    setPending(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      const split = splitApiError<ProfileValues>(result.error, PROFILE_FIELDS);
      setErrors(split.fieldErrors);
      setFormError(split.formError);
      if (hasErrors(split.fieldErrors)) focusFirstError();
      return;
    }
    const saved = result.data.user;
    setValues({ name: saved.name, email: saved.email, currentPassword: "" });
    setSuccess(emailChanged ? `Saved. Sign in with ${saved.email} from now on.` : "Your profile has been updated.");
    onSaved(saved);
  }

  return (
    <SettingsCard
      id="profile-title"
      title="Profile"
      description="Your name appears on your dashboard. Your email is what you sign in with."
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 19.5a7 7 0 0 1 14 0" strokeLinecap="round" />
        </svg>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} noValidate>
        <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <div ref={feedbackRef} className="scroll-mt-24 space-y-3 empty:hidden">
            {success && <SuccessAlert>{success}</SuccessAlert>}
            {formError && <ErrorAlert>{formError}</ErrorAlert>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              name="name"
              autoComplete="name"
              maxLength={100}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              error={errors.name}
            />
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              error={errors.email}
            />
          </div>
          {emailChanged && (
            <TextField
              label="Current password"
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              hint="Needed to change the email you sign in with."
              value={values.currentPassword}
              onChange={(e) => update("currentPassword", e.target.value)}
              error={errors.currentPassword}
            />
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={pending} disabled={!nameChanged && !emailChanged} className="w-full sm:w-auto">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </fieldset>
      </form>
    </SettingsCard>
  );
}

/* ---------- Photos ---------- */

type PhotoKind = "menu" | "portfolio";

const PHOTO_COPY: Record<PhotoKind, { title: string; description: string; hint: string; saved: string; removed: string }> = {
  menu: {
    title: "Menu photo",
    description: "The small round photo in your menu. Use a different one from your portfolio and zoom in on your face.",
    hint: "Crop it to a circle and zoom in. Without one, your menu uses your portfolio photo.",
    saved: "Menu photo saved.",
    removed: "Menu photo removed. Your menu uses your portfolio photo again.",
  },
  portfolio: {
    title: "Portfolio photo",
    description: "The big photo in the middle of your public portfolio. Without one, your initials show.",
    hint: "Any photo. Keep the whole picture (shown full size on your portfolio) or crop it to a circle.",
    saved: "Portfolio photo saved. It shows on your public portfolio.",
    removed: "Portfolio photo removed. Your initials show instead.",
  },
};

/**
 * One photo (menu or portfolio): pick a file, frame it in PhotoCropDialog, upload it; or remove it.
 * The menu photo is circle-only and small; the portfolio photo can also be kept whole.
 */
function PhotoForm({ kind, user, onSaved, onUnauthorized }: { kind: PhotoKind; user: User; onSaved: (user: User) => void; onUnauthorized: () => void }) {
  const copy = PHOTO_COPY[kind];
  const url = kind === "menu" ? user.avatarUrl : user.profilePictureUrl;
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; message: string } | null>(null);
  const [cropping, setCropping] = useState<ImageBitmap | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""; // choosing the same file again still opens it
    if (!file) return;
    setStatus(null);
    try {
      setCropError(null);
      setCropping(await loadPhoto(file));
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Couldn't open that photo." });
    }
  }

  function closeCrop() {
    cropping?.close();
    setCropping(null);
  }

  async function upload(photo: PreparedPhoto) {
    setCropError(null);
    setBusy("uploading");
    const result =
      kind === "menu" ? await uploadAvatarPhoto(photo.blob) : await uploadProfilePhoto(photo.blob, { width: photo.width, height: photo.height });
    setBusy(null);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      setCropError(result.error.message); // stay in the dialog so the crop isn't lost
      return;
    }
    closeCrop();
    onSaved(result.data.user); // the sidebar updates at once
    setStatus({ kind: "saved", message: copy.saved });
  }

  async function remove() {
    setStatus(null);
    setBusy("removing");
    const result = kind === "menu" ? await removeAvatarPhoto() : await removeProfilePhoto();
    setBusy(null);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      setStatus({ kind: "error", message: result.error.message });
      return;
    }
    onSaved(result.data.user);
    setStatus({ kind: "saved", message: copy.removed });
  }

  return (
    <SettingsCard
      id={`${kind}-photo-title`}
      title={copy.title}
      description={copy.description}
      icon={
        kind === "menu" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6.5 18a6.5 6.5 0 0 1 11 0" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
            <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        )
      }
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {kind === "menu" ? (
          // What the menu shows now: the menu photo, else the portfolio photo, else initials.
          <Avatar name={user.name} photoUrl={user.avatarUrl ?? user.profilePictureUrl} className="size-24 text-3xl ring-4 ring-white/80 dark:ring-neutral-800" />
        ) : (
          <PortfolioThumb name={user.name} url={user.profilePictureUrl} />
        )}
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex flex-wrap justify-center gap-3">
            <input
              ref={inputRef}
              id={kind === "menu" ? "avatar-photo-input" : "profile-photo-input"}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
              disabled={busy !== null}
            />
            <Button type="button" onClick={() => inputRef.current?.click()} loading={busy === "uploading"} disabled={busy !== null}>
              {busy === "uploading" ? "Uploading…" : url ? "Change photo" : "Upload photo"}
            </Button>
            {url && (
              <Button type="button" variant="secondary" onClick={remove} loading={busy === "removing"} disabled={busy !== null}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-center text-sm text-neutral-500 sm:text-left dark:text-neutral-400">
            {kind === "menu" && !url && user.profilePictureUrl ? "Using your portfolio photo for now. " : ""}
            {copy.hint}
          </p>
        </div>
      </div>
      <p role="status" className={`mt-4 min-h-5 text-sm ${status?.kind === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}>
        {status?.message}
      </p>
      {cropping && (
        <PhotoCropDialog
          photo={cropping}
          saving={busy === "uploading"}
          error={cropError}
          onSave={upload}
          onCancel={closeCrop}
          {...(kind === "menu" ? { circleOnly: true, title: "Your menu photo", outputSize: 384 } : { title: "Your portfolio photo" })}
        />
      )}
    </SettingsCard>
  );
}

/** The portfolio photo at its own shape (a whole photo isn't a circle), or initials. */
function PortfolioThumb({ name, url }: { name: string; url: string | null }) {
  if (!url) return <Avatar name={name} className="size-24 text-3xl ring-4 ring-white/80 dark:ring-neutral-800" />;
  return (
    <span className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-neutral-100 ring-4 ring-white/80 dark:bg-neutral-800 dark:ring-neutral-800">
      <Image src={url} alt="" fill unoptimized sizes="96px" className="object-contain" />
    </span>
  );
}

/* ---------- Appearance ---------- */

/** Light, dark or black & white. Kept in this browser, not on the account. */
function AppearanceCard() {
  return (
    <SettingsCard
      id="appearance-title"
      title="Appearance"
      description="Light, dark or black & white. Saved on this device; until you pick one, the app follows your device's setting."
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
        </svg>
      }
    >
      <ThemePicker />
    </SettingsCard>
  );
}

/* ---------- Theme color ---------- */

// Fixed colors, not brand-*: brand follows the current theme, and each swatch must show its own.
const THEME_COLOR_SWATCH: Record<ThemeColor, { swatch: string; hint: string }> = {
  RED: { swatch: "bg-gradient-to-br from-[#f87171] via-[#ef4444] to-[#dc2626]", hint: "The JobAssistant classic" },
  BLUE: { swatch: "bg-gradient-to-br from-[#7aa5ff] via-[#4f86ff] to-[#2f6bff]", hint: "Bright azure, calm and sharp" },
  GREEN: { swatch: "bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#04875a]", hint: "Fresh emerald" },
};
const THEME_COLOR_ORDER: readonly ThemeColor[] = ["RED", "BLUE", "GREEN"];

/** The candidate's color for the whole app: buttons, links, the menu, the glass background and the clocks. */
function ThemeColorForm({ user, onSaved, onUnauthorized }: { user: User; onSaved: (user: User) => void; onUnauthorized: () => void }) {
  const [color, setColor] = useState<ThemeColor>(user.themeColor ?? "RED");
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; message: string } | null>(null);

  async function choose(next: ThemeColor) {
    if (next === color) return;
    const previous = color;
    setColor(next);
    setStatus({ kind: "saving", message: "Saving…" });
    const result = await updateAccount({ themeColor: next });
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      setColor(previous);
      setStatus({ kind: "error", message: result.error.message || "Couldn't save your theme color. Please try again." });
      return;
    }
    onSaved(result.data.user); // stored user changes, so the whole app recolors at once
    setStatus({ kind: "saved", message: `${THEME_COLOR_LABEL[next]} theme saved.` });
  }

  return (
    <SettingsCard
      id="theme-color-title"
      title="Theme color"
      description="The color of the whole app for you: buttons, links, the menu, the background and your clocks. Your public portfolio uses it too."
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-4-4-7-9-7Z" strokeLinejoin="round" />
          <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      }
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Theme color</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_COLOR_ORDER.map((option) => {
            const selected = color === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/30 ${
                  selected
                    ? "border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10"
                    : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                }`}
              >
                <input type="radio" name="themeColor" value={option} checked={selected} onChange={() => choose(option)} className="sr-only" />
                <span className={`size-10 shrink-0 rounded-full shadow-md ring-2 ring-white/80 ${THEME_COLOR_SWATCH[option].swatch}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold text-neutral-900 dark:text-white">{THEME_COLOR_LABEL[option]}</span>
                  <span className="block text-sm text-neutral-500 dark:text-neutral-400">{THEME_COLOR_SWATCH[option].hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p role="status" className={`mt-4 min-h-5 text-sm ${status?.kind === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}>
        {status?.message}
      </p>
    </SettingsCard>
  );
}

/* ---------- Clock template ---------- */

const CLOCK_TEMPLATE_HINT: Record<ClockTemplate, string> = {
  MINIMALIST: "Clean and quiet, matches the page",
  NEON: "Glowing digits on a dark panel",
  GLASS: "Frosted panels over a sunset gradient",
};


/** Picks the look of the sidebar clocks (in the theme color); each choice saves straight away. */
function ClockTemplateForm({
  user,
  onSaved,
  onUnauthorized,
}: {
  user: User;
  onSaved: (user: User) => void;
  onUnauthorized: () => void;
}) {
  const [choice, setChoice] = useState<ClockTemplate>(user.clockTemplate ?? "MINIMALIST");
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; message: string } | null>(null);
  const color = user.themeColor ?? "RED"; // clocks follow the theme color

  async function choose(template: ClockTemplate) {
    if (template === choice) return;
    const previous = choice;
    setChoice(template);
    setStatus({ kind: "saving", message: "Saving…" });
    const result = await updateAccount({ clockTemplate: template });
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      setChoice(previous);
      setStatus({ kind: "error", message: result.error.message || "Couldn't save your clock style. Please try again." });
      return;
    }
    onSaved(result.data.user); // the sidebar clocks switch right away
    setStatus({ kind: "saved", message: `${CLOCK_TEMPLATE_LABEL[template]} clocks saved.` });
  }

  return (
    <SettingsCard
      id="clock-title"
      title="Dashboard clocks"
      description="Pacific, Central and Eastern time at the top of your menu, in your theme color. Pick a style."
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Clock style</legend>
        <div className="space-y-3">
          {CLOCK_TEMPLATES.map((template) => {
            const selected = choice === template;
            return (
              <label
                key={template}
                className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-3 transition sm:flex-row sm:items-center sm:gap-5 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/30 ${
                  selected
                    ? "border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10"
                    : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="clockTemplate"
                  value={template}
                  checked={selected}
                  onChange={() => choose(template)}
                  className="sr-only"
                />
                {/* A live preview at the sidebar's real width (w-64), so it looks exactly as it will there. */}
                <UsClocks template={template} color={color} className="pointer-events-none w-full max-w-64 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-neutral-900 dark:text-white">{CLOCK_TEMPLATE_LABEL[template]}</span>
                    {selected && (
                      <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400">{CLOCK_TEMPLATE_HINT[template]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p
        role="status"
        className={`mt-4 min-h-5 text-sm ${status?.kind === "error" ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}
      >
        {status?.message}
      </p>
    </SettingsCard>
  );
}

/* ---------- Password ---------- */

type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };
const PASSWORD_FIELDS = ["currentPassword", "newPassword"] as const;
const EMPTY_PASSWORDS: PasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordForm({ email, onUnauthorized }: { email: string; onUnauthorized: () => void }) {
  const [values, setValues] = useState<PasswordValues>(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<FieldErrors<PasswordValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const feedbackRef = useRevealFeedback(success || formError);

  function update(field: keyof PasswordValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setSuccess(false);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const clientErrors: FieldErrors<PasswordValues> = {
      currentPassword: values.currentPassword ? undefined : "Enter your current password.",
      newPassword: validatePassword(values.newPassword, { strict: true }),
      confirmPassword:
        values.confirmPassword === values.newPassword ? undefined : "This doesn't match your new password.",
    };
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return focusFirstError();

    setPending(true);
    const result = await updateAccount({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    setPending(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      const split = splitApiError<PasswordValues>(result.error, PASSWORD_FIELDS);
      setErrors(split.fieldErrors);
      setFormError(split.formError);
      if (hasErrors(split.fieldErrors)) focusFirstError();
      return;
    }
    setValues(EMPTY_PASSWORDS);
    setSuccess(true);
  }

  return (
    <SettingsCard
      id="password-title"
      title="Password"
      description="Use at least 8 characters. Changing it signs you out on your other devices."
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" strokeLinecap="round" />
        </svg>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} noValidate>
        {/* Lets password managers tie the new password to this account. */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <div ref={feedbackRef} className="scroll-mt-24 space-y-3 empty:hidden">
            {success && <SuccessAlert>Password updated. Your other devices have been signed out.</SuccessAlert>}
            {formError && <ErrorAlert>{formError}</ErrorAlert>}
          </div>
          <TextField
            label="Current password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(e) => update("currentPassword", e.target.value)}
            error={errors.currentPassword}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="New password"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={values.newPassword}
              onChange={(e) => update("newPassword", e.target.value)}
              error={errors.newPassword}
            />
            <TextField
              label="Confirm new password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              error={errors.confirmPassword}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pending} className="w-full sm:w-auto">
              {pending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </fieldset>
      </form>
    </SettingsCard>
  );
}

/* ---------- Shared ---------- */

/**
 * Returns a function that focuses the form's first invalid field after the next render,
 * once the errors are shown and the fieldset is enabled again.
 */
function useFocusFirstError(form: React.RefObject<HTMLFormElement | null>) {
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (request) form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [request, form]);
  return () => setRequest((n) => n + 1);
}

/**
 * Scrolls the success/error banner into view when it appears. The forms are tall on
 * phones, so the banner would otherwise show up above the screen after tapping Save.
 */
function useRevealFeedback(message: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [message]);
  return ref;
}

function SettingsCard({
  id,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex items-start gap-4 border-b border-neutral-100 px-5 py-5 sm:px-8 dark:border-neutral-800">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
      </div>
      <div className="px-5 py-6 sm:px-8">{children}</div>
    </section>
  );
}

function SuccessAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
      <p className="min-w-0 break-words">{children}</p>
    </div>
  );
}
