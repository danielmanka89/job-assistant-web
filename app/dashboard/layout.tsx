import { QuoteBanner } from "@/components/dashboard/quote-banner";
import { Sidebar } from "@/components/dashboard/sidebar";

/**
 * Shared shell for every /dashboard page: sidebar on the left, page content on the right, and the
 * quote banner fixed to the bottom of the window; the content keeps room for it underneath.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <Sidebar />
      <div className="pb-(--quote-banner-space) lg:pl-72">{children}</div>
      <QuoteBanner />
    </div>
  );
}
