import { QuoteBanner } from "@/components/dashboard/quote-banner";
import { Sidebar } from "@/components/dashboard/sidebar";

/**
 * Shared shell for every /dashboard page: sidebar on the left, page content on the right, and the
 * quote banner fixed to the bottom of the window; the content keeps room for it underneath.
 * Everything is frosted glass over a sunset gradient (see .glass-shell in globals.css).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-shell relative isolate min-h-dvh">
      {/* The sunset behind the glass: fixed, so it stays put while pages scroll. */}
      <div className="glass-sunset mono-grayscale fixed inset-0 -z-10" aria-hidden="true" />
      <Sidebar />
      <div className="pb-(--quote-banner-space) lg:pl-72">{children}</div>
      <QuoteBanner />
    </div>
  );
}
