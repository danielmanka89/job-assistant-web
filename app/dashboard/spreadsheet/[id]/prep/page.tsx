import type { Metadata } from "next";
import { MockCallPrep } from "./mock-call-prep";

export const metadata: Metadata = { title: "Mock Call Prep" };

export default async function MockCallPrepPage({ params }: PageProps<"/dashboard/spreadsheet/[id]/prep">) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <MockCallPrep submissionId={id} />
    </main>
  );
}
