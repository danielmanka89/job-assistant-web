"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RegisterRequest } from "@/lib/types";
import { register } from "@/lib/client/api";
import { hasErrors, splitApiError, validateEmail, validatePassword, type FieldErrors } from "@/lib/client/forms";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";

const FIELDS = ["name", "email", "password"] as const;

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<RegisterRequest>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<RegisterRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: keyof RegisterRequest, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors: FieldErrors<RegisterRequest> = {
      name: values.name.trim() ? undefined : "Enter your name.",
      email: validateEmail(values.email),
      password: validatePassword(values.password, { strict: true }),
    };
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    setPending(true);
    const result = await register({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    if (!result.ok) {
      const { fieldErrors, formError } = splitApiError<RegisterRequest>(result.error, FIELDS);
      setErrors(fieldErrors);
      setFormError(formError);
      setPending(false);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <ErrorAlert>{formError}</ErrorAlert>}
      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        placeholder="Jane Doe"
        value={values.name}
        onChange={(e) => update("name", e.target.value)}
        error={errors.name}
      />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        hint="Use 8 or more characters."
        value={values.password}
        onChange={(e) => update("password", e.target.value)}
        error={errors.password}
      />
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
