// Mobile numbers, stored in international (E.164) form: "+" and 8 to 15 digits, e.g. "+15551234567".
// Shared by the browser and the server.

/**
 * Turns what someone typed into "+<digits>", or null if it can't be a phone number. Spaces, dashes,
 * dots and brackets are ignored. Ten digits with no country code are taken as a US/Canada number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^00[1-9]\d{7,14}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export function phoneError(input: string): string | undefined {
  if (!input.trim()) return "Mobile number is required";
  if (!normalizePhone(input)) return "Enter your mobile number with its country code, like +1 555 123 4567";
}

/** "•••• 4567": enough to recognise your own number, not enough to learn someone else's. */
export const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;
