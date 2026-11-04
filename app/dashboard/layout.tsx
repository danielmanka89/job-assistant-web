import { QuoteBanner } from "@/components/dashboard/quote-banner";
import { Sidebar } from "@/components/dashboard/sidebar";

/**
 * Shared shell for every /dashboard page: sidebar on the left, page content on the right, and the
 * quote banner across the bottom of the content (at the bottom of the window on short pages; phones
 * subtract the 4rem top bar).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <Sidebar />
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:min-h-dvh lg:pl-72">
        <div className="flex-1">{children}</div>
        <QuoteBanner />
      </div>
    </div>
  );
}
