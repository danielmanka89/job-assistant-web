// Rules shared by register and account settings, so both accept the same names, emails and passwords.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_CHARS = 100;
const MIN_PASSWORD_CHARS = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function emailError(email: string): string | undefined {
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
}

export function nameError(name: string): string | undefined {
  if (!name) return "Name is required";
  if (name.length > MAX_NAME_CHARS) return `Name must be ${MAX_NAME_CHARS} characters or fewer`;
}

export function passwordError(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_CHARS) return `Password must be at least ${MIN_PASSWORD_CHARS} characters`;
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer`;
}
