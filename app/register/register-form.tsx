"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RegisterRequest, UserRole } from "@/lib/types";
import { register } from "@/lib/client/api";
import { storeUser } from "@/lib/client/current-user";
import { speakLoginGreeting } from "@/lib/client/voice-greeting";
import { normalizePhone, phoneError } from "@/lib/phone";
import { RolePicker } from "./role-picker";
import { hasErrors, splitApiError, validateEmail, validatePassword, type FieldErrors } from "@/lib/client/forms";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";

const FIELDS = ["name", "email", "phone", "password", "role"] as const;

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<RegisterRequest>({ name: "", email: "", phone: "", password: "", role: "SEEKER" });
  const [errors, setErrors] = useState<FieldErrors<RegisterRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: Exclude<keyof RegisterRequest, "role">, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors: FieldErrors<RegisterRequest> = {
      name: values.name.trim() ? undefined : "Enter your name.",
      email: validateEmail(values.email),
      phone: phoneError(values.phone),
      password: validatePassword(values.password, { strict: true }),
    };
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    setPending(true);
    const result = await register({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: normalizePhone(values.phone) ?? values.phone,
      password: values.password,
      role: values.role,
    });
    if (!result.ok) {
      const { fieldErrors, formError } = splitApiError<RegisterRequest>(result.error, FIELDS);
      setErrors(fieldErrors);
      setFormError(formError);
      setPending(false);
      return;
    }
    storeUser(result.data.user);
    speakLoginGreeting(result.data.user);
    router.replace(result.data.user.role === "EMPLOYER" ? "/dashboard/employer" : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
      {formError && <ErrorAlert>{formError}</ErrorAlert>}
      <RolePicker
        value={values.role ?? "SEEKER"}
        onChange={(role: UserRole) => {
          setValues((v) => ({ ...v, role }));
          if (errors.role) setErrors((e) => ({ ...e, role: undefined }));
        }}
        error={errors.role}
      />
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
        label="Mobile number"
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        placeholder="+1 555 123 4567"
        hint="With your country code. If you ever forget your password, we text a code here as well as emailing one."
        value={values.phone}
        onChange={(e) => update("phone", e.target.value)}
        error={errors.phone}
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
      </fieldset>
    </form>
  );
}
