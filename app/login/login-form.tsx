"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LoginRequest } from "@/lib/types";
import { login } from "@/lib/client/api";
import { storeUser } from "@/lib/client/current-user";
import { hasErrors, splitApiError, validateEmail, validatePassword, type FieldErrors } from "@/lib/client/forms";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";

const FIELDS = ["email", "password"] as const;

export function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState<LoginRequest>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<LoginRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: keyof LoginRequest, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors: FieldErrors<LoginRequest> = {
      email: validateEmail(values.email),
      password: validatePassword(values.password, { strict: false }),
    };
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    setPending(true);
    const result = await login({ ...values, email: values.email.trim() });
    if (!result.ok) {
      const { fieldErrors, formError } = splitApiError<LoginRequest>(result.error, FIELDS);
      setErrors(fieldErrors);
      setFormError(formError);
      setPending(false);
      return;
    }
    storeUser(result.data.user);
    router.replace(result.data.user.role === "EMPLOYER" ? "/dashboard/employer" : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
      {formError && <ErrorAlert>{formError}</ErrorAlert>}
      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={values.email}
        onChange={(e) => update("email", e.target.value)}
        error={errors.email}
      />
      <TextField
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={values.password}
        onChange={(e) => update("password", e.target.value)}
        error={errors.password}
      />
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      </fieldset>
    </form>
  );
}
