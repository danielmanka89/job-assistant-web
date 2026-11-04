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
      <div
        className="mono-grayscale fixed inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_10%_0%,#ffe1c2,transparent_60%),radial-gradient(50rem_40rem_at_95%_15%,#ffc2d1,transparent_60%),radial-gradient(60rem_45rem_at_70%_100%,#e9d5ff,transparent_60%),linear-gradient(160deg,#fff1e6_0%,#ffd9c7_35%,#fbcfe8_70%,#e9e3ff_100%)] dark:bg-[radial-gradient(60rem_40rem_at_10%_0%,rgba(234,88,12,0.35),transparent_60%),radial-gradient(50rem_40rem_at_95%_15%,rgba(225,29,72,0.3),transparent_60%),radial-gradient(60rem_45rem_at_70%_100%,rgba(124,58,237,0.28),transparent_60%),linear-gradient(160deg,#1a0d12_0%,#2a0f1c_45%,#170f26_100%)]"
        aria-hidden="true"
      />
      <Sidebar />
      <div className="pb-(--quote-banner-space) lg:pl-72">{children}</div>
      <QuoteBanner />
    </div>
  );
}
