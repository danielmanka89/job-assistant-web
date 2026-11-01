import type { Metadata } from "next";
import { DashboardOverview } from "./dashboard-overview";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <DashboardOverview />
    </main>
  );
}
