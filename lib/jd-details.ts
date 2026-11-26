// Reading a JD's details (role, client, location, rate, vendor) from the pasted text without AI.
// Used when the AI service isn't available, and by mock mode. No server-only imports.

import type { VendorJdFields } from "@/lib/types";

export type JdDetails = Omit<VendorJdFields, "notes">;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Personal mail services say nothing about the vendor's company.
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|zoho|gmx|mail|rediffmail)$/i;

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").replace(/^[\s:–-]+|[\s.;,]+$/g, "").trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : text;
};

/** The value of the first "Label: value" line whose label matches. */
function labelled(text: string, labels: string): string {
  const match = text.match(new RegExp(`^[\\s*•\\-]*(?:${labels})\\s*(?:[:\\-–]|\\bis\\b)\\s*(.+)$`, "im"));
  return match ? match[1] : "";
}

/** A role name: a "Job Title:" line, or else the first short line. */
export function guessTitle(description: string): string {
  const fromLabel = labelled(description, "job\\s*title|position|role|title|job\\s*role");
  const firstLine = description.split(/\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const pick = clip(fromLabel || firstLine.replace(/^(subject|re|fw|fwd)\s*:\s*/i, ""), 150);
  return pick || "Untitled JD";
}

/** "acme-staffing.com" -> "Acme Staffing". */
function companyFromDomain(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const name = domain.split(".").slice(-2)[0] ?? "";
  if (!name || FREE_MAIL.test(name)) return "";
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** The sender's name and company from a sign-off ("Thanks,\nPriya Sharma\nApex Systems"). */
function signature(text: string): { name: string; company: string } {
  const lines = text.split(/\n/).map((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/^(thanks|thank you|regards|best regards|warm regards|kind regards|best|sincerely|cheers)\b[\s,!.]*$/i.test(lines[i])) continue;
    const after = lines.slice(i + 1).filter(Boolean);
    const isPlain = (l: string | undefined) => !!l && l.length <= 60 && !EMAIL.test(l) && !/\d{3}/.test(l) && !/^(https?:|www\.)/i.test(l);
    const name = isPlain(after[0]) && /^[A-Za-z][A-Za-z.'\- ]+$/.test(after[0]) ? after[0] : "";
    // The company is usually the next plain line that isn't a job title.
    const company =
      after.slice(name ? 1 : 0, 4).find((l) => isPlain(l) && !/(recruiter|manager|lead|specialist|talent|account|executive|director|consultant|associate)/i.test(l)) ?? "";
    return { name: clip(name, 120), company: clip(company, 120) };
  }
  return { name: "", company: "" };
}

/** Best-effort details from the text; anything not found is "". */
export function detectJdDetails(text: string): JdDetails {
  const email = text.match(EMAIL)?.[0]?.toLowerCase() ?? "";
  const sig = signature(text);
  return {
    title: guessTitle(text),
    client: clip(labelled(text, "end\\s*client|client\\s*name|client"), 120),
    location: clip(labelled(text, "work\\s*location|job\\s*location|location"), 120),
    rate: clip(labelled(text, "pay\\s*rate|bill\\s*rate|rate|compensation|salary|pay"), 60),
    vendorCompany: sig.company || companyFromDomain(email),
    vendorContact: sig.name,
    vendorEmail: email.length <= 254 ? email : "",
  };
}
