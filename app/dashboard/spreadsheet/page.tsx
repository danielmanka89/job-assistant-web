import type { Metadata } from "next";
import { SpreadsheetView } from "./spreadsheet-view";

export const metadata: Metadata = { title: "Spreadsheet" };

export default function SpreadsheetPage() {
  return (
    <main className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Spreadsheet</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Every job you apply to is added here automatically. Fill in the vendor, submission, skill and client
          details, and download it all as an Excel file.
        </p>
      </div>
      <SpreadsheetView />
    </main>
  );
}
