import { QuoteBanner } from "@/components/dashboard/quote-banner";
import { Sidebar } from "@/components/dashboard/sidebar";
import { HelpAssistant } from "@/components/help/help-assistant";

/**
 * Shared shell for every /dashboard page: sidebar on the left, page content on the right, and the
 * quote banner fixed to the bottom of the window; the content keeps room for it underneath.
 * Blue Glass: a light window inside a thick frame over a gradient in the theme color (see .glass-shell,
 * .app-window and .app-frame in globals.css).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-shell relative isolate min-h-dvh">
      {/* The sunset behind the glass: fixed, so it stays put while pages scroll. */}
      <div className="glass-sunset mono-grayscale fixed inset-0 -z-10" aria-hidden="true" />
      <Sidebar />
      {/* The app's window. From lg up it sits inside the frame and scrolls itself; no sideways scrolling. */}
      <div className="app-window min-h-dvh overflow-x-hidden pb-(--quote-banner-space) lg:fixed lg:inset-(--edge) lg:min-h-0 lg:overflow-y-auto lg:pl-72">{children}</div>
      <QuoteBanner />
      <HelpAssistant />
      <div className="app-frame" aria-hidden="true" />
    </div>
  );
}
