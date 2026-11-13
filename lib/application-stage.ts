// Where an application stands, from the Status the person keeps on their Spreadsheet row. The Job
// Board colors each applied job by it. Shared, no server-only imports.

export type ApplicationStage = "applied" | "review" | "approved" | "rejected" | "withdrawn";

const STAGE_OF_STATUS: Record<string, ApplicationStage> = {
  Applied: "applied",
  "Submitted to vendor": "review",
  "On hold": "review",
  "Submitted to client": "approved",
  "Interview scheduled": "approved",
  Interviewed: "approved",
  Offer: "approved",
  Placed: "approved",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
};

/** The stage for a Spreadsheet status; a blank or unknown status counts as just applied. */
export function stageOf(status: string | null | undefined): ApplicationStage {
  return STAGE_OF_STATUS[(status ?? "").trim()] ?? "applied";
}

/** Order and wording for the legend and the status chips. */
export const STAGES: { stage: ApplicationStage; label: string; hint: string }[] = [
  { stage: "applied", label: "Applied", hint: "You applied" },
  { stage: "review", label: "Under review", hint: "Submitted to the vendor, or on hold" },
  { stage: "approved", label: "Approved", hint: "The vendor submitted your profile, or you're interviewing" },
  { stage: "rejected", label: "Not selected", hint: "Rejected" },
  { stage: "withdrawn", label: "Withdrawn", hint: "You withdrew" },
];
