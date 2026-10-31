import type { ApiError } from "@/lib/types";

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Enter your email address.";
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
}

export function validatePassword(password: string, { strict }: { strict: boolean }) {
  if (!password) return "Enter your password.";
  if (strict && password.length < 8) return "Use at least 8 characters.";
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Splits an ApiError into errors for the inputs on this form and a message
 * for the banner. Field errors for unknown fields fall back to the banner.
 */
export function splitApiError<T>(
  error: ApiError,
  fields: readonly (keyof T & string)[],
): { fieldErrors: FieldErrors<T>; formError: string | null } {
  const fieldErrors: FieldErrors<T> = {};
  const unknown: string[] = [];

  for (const [key, message] of Object.entries(error.fieldErrors ?? {})) {
    if ((fields as readonly string[]).includes(key)) {
      fieldErrors[key as keyof T & string] = message;
    } else {
      unknown.push(message);
    }
  }

  const matched = hasErrors(fieldErrors);
  const formError = unknown.length > 0 ? unknown.join(" ") : matched ? null : error.message;
  return { fieldErrors, formError };
}
