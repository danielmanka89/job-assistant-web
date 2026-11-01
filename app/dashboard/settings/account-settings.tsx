"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ApiError, UpdateAccountRequest, User } from "@/lib/types";
import { getAccount, logout, updateAccount } from "@/lib/client/api";
import { storeUser } from "@/lib/client/current-user";
import { hasErrors, splitApiError, validateEmail, validatePassword, type FieldErrors } from "@/lib/client/forms";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

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
      <ProfileForm user={state.user} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      <PasswordForm onUnauthorized={onUnauthorized} />
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
    if (hasErrors(clientErrors)) return;

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
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {success && <SuccessAlert>{success}</SuccessAlert>}
          {formError && <ErrorAlert>{formError}</ErrorAlert>}
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

/* ---------- Password ---------- */

type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };
const PASSWORD_FIELDS = ["currentPassword", "newPassword"] as const;
const EMPTY_PASSWORDS: PasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordForm({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [values, setValues] = useState<PasswordValues>(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<FieldErrors<PasswordValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

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
    if (hasErrors(clientErrors)) return;

    setPending(true);
    const result = await updateAccount({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    setPending(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      const split = splitApiError<PasswordValues>(result.error, PASSWORD_FIELDS);
      setErrors(split.fieldErrors);
      setFormError(split.formError);
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
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {success && <SuccessAlert>Password updated. Your other devices have been signed out.</SuccessAlert>}
          {formError && <ErrorAlert>{formError}</ErrorAlert>}
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
