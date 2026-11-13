import type { Metadata } from "next";
import { AddToResumeButton } from "./add-to-resume-button";
// Hidden for now; restore this import and the button below to bring My Introduction back.
// import { MyIntroductionButton } from "./my-introduction";
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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:flex lg:h-[calc(100dvh-var(--quote-banner-space)-2*var(--edge))] lg:flex-col lg:pb-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 lg:shrink-0">
        <div className="min-w-0 flex-[999_1_20rem]">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">My Profile</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Filled in from your resume and used every time you apply or tailor. To change it, update your resume.
          </p>
        </div>
        {/* Side by side, compact; the public status sits under the portfolio button. */}
        <div className="flex flex-wrap items-start gap-2">
          {/* <MyIntroductionButton /> */}
          <AddToResumeButton />
          <PublicPortfolioButton />
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
