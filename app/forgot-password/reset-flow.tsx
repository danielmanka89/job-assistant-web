"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { checkResetCode, completePasswordReset, startPasswordReset } from "@/lib/client/api";
import { validateEmail, validatePassword } from "@/lib/client/forms";
import { ErrorAlert, SuccessAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { ApiError } from "@/lib/types";

type Step = "email" | "emailCode" | "phoneCode" | "password" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "emailCode", label: "Email code" },
  { key: "phoneCode", label: "Text code" },
  { key: "password", label: "New password" },
];

/** Forgot password: email → emailed code → texted code → new password. */
export function ResetFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [phoneHint, setPhoneHint] = useState("");
  const [noPhone, setNoPhone] = useState(false);
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLFormElement>(null);

  // Each new step starts empty with the cursor in its field.
  useEffect(() => {
    input.current?.querySelector<HTMLInputElement>("input:not([hidden])")?.focus();
  }, [step]);

  function go(next: Step) {
    setValue("");
    setConfirm("");
    setFieldError(undefined);
    setFormError(null);
    setStep(next);
  }

  function showError(error: ApiError) {
    const field = error.fieldErrors && Object.values(error.fieldErrors)[0];
    if (field) setFieldError(field);
    else setFormError(error.message);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(undefined);
    setFormError(null);

    if (step === "email") {
      const error = validateEmail(email);
      if (error) return setFieldError(error);
      setPending(true);
      const result = await startPasswordReset(email.trim());
      setPending(false);
      if (!result.ok) return showError(result.error);
      setToken(result.data.token);
      return go("emailCode");
    }

    if (step === "emailCode" || step === "phoneCode") {
      const code = value.replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) return setFieldError("Enter the 6-digit code.");
      setPending(true);
      const result = await checkResetCode(step === "emailCode" ? "email" : "phone", token, code);
      setPending(false);
      if (!result.ok) return showError(result.error);
      if (result.data.next === "phone") {
        setPhoneHint(result.data.phoneHint ?? "");
        return go("phoneCode");
      }
      if (step === "emailCode") setNoPhone(true);
      return go("password");
    }

    if (step === "password") {
      const error = validatePassword(value, { strict: true });
      if (error) return setFieldError(error);
      if (confirm !== value) return setFormError("The two passwords don't match.");
      setPending(true);
      const result = await completePasswordReset(token, value);
      setPending(false);
      if (!result.ok) return showError(result.error);
      go("done");
    }
  }

  if (step === "done") {
    return (
      <div className="space-y-5">
        <SuccessAlert>Your password has been reset, and every device was signed out. We&apos;ve emailed you to confirm.</SuccessAlert>
        <Link href="/login" className="block w-full rounded-2xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-500">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.key === step);
  const codeField = (label: string, hint: string) => (
    <TextField
      label={label}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="123456"
      hint={hint}
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/[^\d ]/g, ""))}
      error={fieldError}
      className="text-center font-mono text-lg tracking-[0.4em]"
    />
  );

  return (
    <form ref={input} onSubmit={onSubmit} noValidate>
      <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
        {step !== "email" && (
          <ol className="flex items-center gap-1.5 text-[11px] font-semibold" aria-label="Progress">
            {STEPS.map((s, i) => {
              const skipped = s.key === "phoneCode" && noPhone;
              const state = skipped ? "skip" : i < current ? "done" : i === current ? "now" : "next";
              return (
                <li key={s.key} aria-current={state === "now" ? "step" : undefined} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${
                      state === "done" ? "bg-emerald-500 text-white" : state === "now" ? "bg-brand-600 text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={state === "now" ? "text-neutral-900 dark:text-white" : "text-neutral-400"}>{skipped ? `${s.label} (no phone)` : s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {formError && <ErrorAlert>{formError}</ErrorAlert>}

        {step === "email" && (
          <TextField
            label="Your account email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            hint="We'll email you a 6-digit code."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
        )}
        {step === "emailCode" &&
          codeField("Code from your email", `If ${email.trim()} has an account, a code is on its way. It expires in 15 minutes; check Spam too.`)}
        {step === "phoneCode" && codeField("Code from your text message", `We texted a code to your phone ending ${phoneHint.replace(/\D/g, "")}.`)}
        {step === "password" && (
          <>
            {noPhone && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Your account has no mobile number yet. After signing in, add one in Settings so resets need your phone too.
              </p>
            )}
            {/* Lets password managers save the new password for this account. */}
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <TextField
              label="New password"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={fieldError}
            />
            <TextField label="Confirm new password" type="password" name="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </>
        )}

        <Button type="submit" loading={pending} className="w-full">
          {step === "email" ? "Email me a code" : step === "password" ? "Set new password" : "Continue"}
        </Button>
        {step !== "email" && (
          <button type="button" onClick={() => go("email")} className="block w-full text-center text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            Start again
          </button>
        )}
      </fieldset>
    </form>
  );
}
