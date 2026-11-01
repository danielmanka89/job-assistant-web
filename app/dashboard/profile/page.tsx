import type { Metadata } from "next";
import { MarketReachPanel } from "./market-reach-panel";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "My Profile" };

// On large screens the page fills the window and the two columns scroll on their own, so Market
// Reach stays in view while reading the profile (and the other way round). Phones scroll as one page.
const column = "lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-6 lg:outline-none lg:focus-visible:ring-4 lg:focus-visible:ring-brand-500/30";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:flex lg:h-dvh lg:flex-col lg:pb-0">
      <div className="mb-8 max-w-2xl lg:shrink-0">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My Profile</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Filled in from your resume and used automatically every time you apply to a job or tailor your resume.
          To change it, upload an updated resume.
        </p>
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
