import type { Metadata } from "next";
import { AddToResumeButton } from "./add-to-resume-button";
import { PublicPortfolioButton } from "./public-portfolio-button";
import { MarketReachPanel } from "./market-reach-panel";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "My Profile" };

// On large screens the page fills the window (above the quote banner) and the two columns scroll on their own, so Market
// Reach stays in view while reading the profile (and the other way round). The scrollbars are hidden
// to keep the page calm; the columns still scroll with the wheel, trackpad and keyboard. Phones
// scroll as one page.
// The columns can be focused at every size (tabIndex can't be responsive), so the focus ring shows at
// every size too; otherwise phone keyboard users would land on an invisible focus stop.
const column =
  "rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-none lg:px-1 lg:pb-6";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:flex lg:h-[calc(100dvh-var(--quote-banner-space))] lg:flex-col lg:pb-0">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:shrink-0">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My Profile</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Filled in from your resume and used automatically every time you apply to a job or tailor your resume.
            To change it, add missing details to your resume or upload an updated one.
          </p>
        </div>
        {/* Stacked, so both fit beside the title at every width. */}
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <PublicPortfolioButton />
          <AddToResumeButton />
        </div>
      </div>
      <div className="grid items-start gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch lg:gap-8">
        {/* tabIndex: keyboard users can focus a column and scroll it with the arrow keys. */}
        <section aria-label="Profile" tabIndex={0} className={column}>
          <ProfileView />
        </section>
        <aside aria-label="Market Reach" tabIndex={0} className={`order-first lg:order-none ${column}`}>
          <MarketReachPanel />
        </aside>
      </div>
    </main>
  );
}
