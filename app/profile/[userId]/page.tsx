import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getPublicPortfolio } from "@/lib/public-portfolio";
import { accentFor } from "@/lib/theme-color";
import type { PublicPortfolio } from "@/lib/types";

// Always read fresh: making the portfolio private must take effect at once.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const portfolio = await getPublicPortfolio((await params).userId);
  // Shared by link only: keep personal details out of search engines.
  const robots = { index: false, follow: false };
  if (!portfolio) return { title: "Portfolio not found", robots };
  return { title: `${portfolio.name} · Portfolio`, description: portfolio.summary.slice(0, 160) || undefined, robots };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (ym: string | null | undefined) => {
  const m = ym?.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim() : (ym ?? "");
};
const range = (start: string | undefined, end: string | null | undefined, current: string) =>
  [month(start), end === null ? current : month(end)].filter(Boolean).join(" – ");

// Links come from a parsed resume: only plain web links become clickable.
function webUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * A candidate's public portfolio, shared with recruiters by link. One screen, no scrolling: the
 * greeting on top, a portrait circle in the middle, and glass cards arranged around it. On phones
 * the cards sit in a row below the circle and swipe sideways.
 */
export default async function PublicPortfolioPage({ params }: Props) {
  const portfolio = await getPublicPortfolio((await params).userId);
  if (!portfolio) notFound();
  const p = portfolio;
  const headline = [p.workExperience[0]?.jobTitle, p.location].filter(Boolean).join(" · ");
  // A whole (rectangular) photo is wider than the circle: nudge the cards less so they don't cover it.
  const whole = isWholePhoto(p);
  const nudgeLeft = whole ? "translate-x-3" : "translate-x-10"; // full class names, so Tailwind sees them
  const nudgeRight = whole ? "-translate-x-3" : "-translate-x-10";

  const left = [
    <SummaryCard key="summary" p={p} />,
    <SkillsCard key="skills" p={p} />,
    <ExperienceCard key="experience" p={p} />,
  ];
  const right = [
    <EducationCard key="education" p={p} />,
    <ContactCard key="contact" p={p} />,
    <ResumeCard key="resume" p={p} />,
  ];

  return (
    // data-accent: the owner's theme color, whatever color the viewer's own account uses.
    <main
      data-accent={accentFor(p.themeColor)}
      className="relative isolate flex h-dvh w-screen flex-col overflow-hidden bg-white text-neutral-900 dark:bg-[#0c0c0c] dark:text-white">
      {/* Soft red light behind the glass, and faint rings around the portrait. */}
      <div
        className="mono-grayscale pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45rem_35rem_at_50%_55%,rgb(var(--brand-glow)/0.12),transparent_70%),radial-gradient(40rem_30rem_at_0%_0%,rgb(var(--brand-glow)/0.08),transparent_70%),radial-gradient(40rem_30rem_at_100%_100%,rgb(var(--brand-glow)/0.08),transparent_70%)] dark:bg-[radial-gradient(45rem_35rem_at_50%_55%,rgb(var(--brand-glow)/0.28),transparent_70%),radial-gradient(40rem_30rem_at_0%_0%,rgb(var(--brand-glow-deep)/0.25),transparent_70%),radial-gradient(40rem_30rem_at_100%_100%,rgb(var(--brand-glow-deep)/0.25),transparent_70%)]"
        aria-hidden="true"
      />

      <header className="shrink-0 px-14 pt-8 text-center sm:px-6 sm:pt-10 lg:[@media(max-height:820px)]:pt-5">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight uppercase sm:text-5xl lg:text-6xl lg:[@media(max-height:820px)]:text-5xl">
          Hello, I&apos;m <span className="text-brand-600 dark:text-brand-500">{p.name}</span>
        </h1>
        {headline && <p className="mt-2 text-sm font-medium text-neutral-500 sm:text-base dark:text-neutral-400">{headline}</p>}
      </header>

      {/* Large screens: cards around the circle, nudged toward it at the top and bottom to follow its curve. */}
      <div className="mx-auto hidden min-h-0 w-full max-w-7xl flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8 px-8 py-6 lg:grid [@media(max-height:820px)]:py-3">
        <div className="flex h-full min-h-0 flex-col justify-center gap-4 [@media(max-height:820px)]:gap-3">
          {left.map((card, i) => (
            <div key={i} className={`min-h-0 ${i === 1 ? "" : nudgeLeft}`}>
              {card}
            </div>
          ))}
        </div>
        <Portrait name={p.name} photoUrl={p.profilePictureUrl} photoSize={p.profilePictureSize} />
        <div className="flex h-full min-h-0 flex-col justify-center gap-4 [@media(max-height:820px)]:gap-3">
          {right.map((card, i) => (
            <div key={i} className={`min-h-0 ${i === 1 ? "" : nudgeRight}`}>
              {card}
            </div>
          ))}
        </div>
      </div>

      {/* Phones and tablets: the circle, then the cards in a row that swipes sideways. */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="grid shrink-0 place-items-center py-7">
          <Portrait name={p.name} photoUrl={p.profilePictureUrl} photoSize={p.profilePictureSize} small />
        </div>
        {/* role + tabIndex: a named region keyboard users can focus and scroll with the arrow keys
            (most cards have nothing focusable inside, and Safari doesn't focus plain scrollers). */}
        <div
          role="region"
          tabIndex={0}
          aria-label="Portfolio details"
          className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-6 pb-4 scrollbar-none outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:ring-inset"
        >
          {[...left, ...right].map((card, i) => (
            <div key={i} className="h-full max-h-80 w-[82vw] max-w-sm shrink-0 snap-center">
              {card}
            </div>
          ))}
        </div>
        <p className="shrink-0 pb-2 text-center text-xs text-neutral-400">Swipe for more</p>
      </div>

      <footer className="shrink-0 pb-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
        Shared with{" "}
        <Link href="/" className="font-semibold text-brand-600 hover:underline dark:text-brand-500">
          JobAssistant
        </Link>
      </footer>
    </main>
  );
}

/** True when the photo was saved whole (not cropped to a square for the circle). */
function isWholePhoto(p: Pick<PublicPortfolio, "profilePictureUrl" | "profilePictureSize">) {
  const size = p.profilePictureSize;
  return Boolean(p.profilePictureUrl && size && Math.abs(size.width / size.height - 1) > 0.08);
}

function Portrait({
  name,
  photoUrl,
  photoSize,
  small = false,
}: {
  name: string;
  photoUrl: string | null;
  photoSize: PublicPortfolio["profilePictureSize"];
  small?: boolean;
}) {
  // A whole photo (not cropped to a square) stands at its own shape in front of the ring.
  if (photoUrl && photoSize && isWholePhoto({ profilePictureUrl: photoUrl, profilePictureSize: photoSize })) {
    return (
      <div className="relative grid shrink-0 place-items-center">
        {/* The ring behind the photo, and the slow orbit around it. */}
        <div
          className={`absolute rounded-full border-[6px] border-brand-600 bg-brand-50/40 shadow-2xl shadow-brand-600/20 dark:bg-brand-950/20 ${small ? "size-[min(26vh,12rem)]" : "size-[min(48vh,26rem)]"}`}
          aria-hidden="true"
        />
        <div
          className={`absolute animate-[spin_80s_linear_infinite] rounded-full border border-dashed border-brand-600/30 motion-reduce:animate-none dark:border-brand-500/30 ${small ? "size-[min(30vh,14rem)]" : "size-[min(54vh,30rem)]"}`}
          aria-hidden="true"
        />
        <Image
          src={photoUrl}
          alt={`${name}'s portrait`}
          width={photoSize.width}
          height={photoSize.height}
          unoptimized // already sized by the browser that uploaded it
          priority
          className={`relative h-auto w-auto rounded-2xl object-contain shadow-2xl shadow-black/25 ring-1 ring-black/5 ${small ? "max-h-[30vh] max-w-[70vw]" : "max-h-[min(64vh,36rem)] max-w-[min(34vw,28rem)] [@media(max-height:820px)]:max-h-[58vh]"}`}
        />
      </div>
    );
  }
  return (
    <div className={`relative grid shrink-0 place-items-center ${small ? "size-[min(30vh,14rem)]" : "size-[min(46vh,24rem)]"}`}>
      {/* An orbit ring around the portrait. */}
      <div
        className="absolute -inset-6 animate-[spin_80s_linear_infinite] rounded-full border border-dashed border-brand-600/30 motion-reduce:animate-none dark:border-brand-500/30"
        aria-hidden="true"
      />
      <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 shadow-2xl shadow-brand-600/30" aria-hidden="true" />
      {/* The candidate's photo (added in Settings), or their initials over a silhouette. */}
      <div
        role="img"
        aria-label={`${name}'s portrait`}
        className="relative grid size-full place-items-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-b from-neutral-50 to-brand-50 dark:border-neutral-900 dark:from-neutral-900 dark:to-brand-950/40"
      >
        {photoUrl ? (
          // unoptimized: already a small square from our own API. priority: it's the page's main image.
          <Image src={photoUrl} alt="" fill unoptimized priority sizes="24rem" className="object-cover" />
        ) : (
          <>
            <svg viewBox="0 0 100 100" className="absolute inset-x-0 bottom-0 h-[78%] w-full text-brand-600/10 dark:text-brand-500/15" aria-hidden="true">
              <circle cx="50" cy="38" r="20" fill="currentColor" />
              <path d="M10 100c4-22 20-34 40-34s36 12 40 34Z" fill="currentColor" />
            </svg>
            <span className={`relative font-display font-bold text-brand-600 dark:text-brand-500 ${small ? "text-5xl" : "text-7xl"}`}>{initials(name)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function GlassCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex h-full max-h-[calc((100dvh-15rem)/3)] min-h-0 flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/65 p-5 shadow-[0_10px_40px_rgb(var(--brand-glow)/0.10)] backdrop-blur-xl max-lg:max-h-none lg:[@media(max-height:820px)]:max-h-[calc((100dvh-11rem)/3)] lg:[@media(max-height:820px)]:p-4 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/40">
      <h2 className="flex shrink-0 items-center gap-2 text-xs font-semibold tracking-widest text-brand-600 uppercase dark:text-brand-400">
        <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {/* Short laptop screens show fewer items (see each card); the fade covers anything still too long. */}
      <div className="mt-3 min-h-0 flex-1 overflow-hidden lg:[@media(max-height:820px)]:mt-2 lg:[@media(max-height:820px)]:[mask-image:linear-gradient(to_bottom,black_82%,transparent)]">{children}</div>
    </section>
  );
}

const ICON = "size-3.5";
const None = ({ children }: { children: ReactNode }) => <p className="text-sm text-neutral-400 italic">{children}</p>;

function SummaryCard({ p }: { p: PublicPortfolio }) {
  return (
    <GlassCard
      title="Summary"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
        </svg>
      }
    >
      {p.summary ? <p className="line-clamp-5 text-sm leading-relaxed text-neutral-700 lg:[@media(max-height:820px)]:line-clamp-3 dark:text-neutral-200">{p.summary}</p> : <None>No summary on the resume.</None>}
    </GlassCard>
  );
}

function SkillsCard({ p }: { p: PublicPortfolio }) {
  const shown = p.skills.slice(0, 10);
  return (
    <GlassCard
      title="Performance"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path d="M11.3 1.05a.75.75 0 0 1 .43.83L10.9 7h5.35a.75.75 0 0 1 .56 1.25l-8 9a.75.75 0 0 1-1.29-.63L8.35 12H3a.75.75 0 0 1-.56-1.25l8-9a.75.75 0 0 1 .86-.2Z" />
        </svg>
      }
    >
      {shown.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((skill, i) => (
            <li key={`${i}-${skill}`} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {skill}
            </li>
          ))}
          {p.skills.length > shown.length && (
            <li className="rounded-full border border-dashed border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:border-brand-500/40 dark:text-brand-300">
              +{p.skills.length - shown.length} more
            </li>
          )}
        </ul>
      ) : (
        <None>No skills on the resume.</None>
      )}
    </GlassCard>
  );
}

function ExperienceCard({ p }: { p: PublicPortfolio }) {
  return (
    <GlassCard
      title="Experience"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path fillRule="evenodd" d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75V5h1.25A2.75 2.75 0 0 1 18 7.75v7.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-7.5A2.75 2.75 0 0 1 4.75 5H6V3.75Zm1.5 0V5h5V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25Z" clipRule="evenodd" />
        </svg>
      }
    >
      {p.workExperience.length ? (
        <ol className="space-y-2.5 lg:[@media(max-height:820px)]:space-y-2 lg:[@media(max-height:820px)]:[&>li:nth-child(n+3)]:hidden">
          {p.workExperience.slice(0, 3).map((job, i) => (
            <li key={i} className="border-l-2 border-brand-600/60 pl-3">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{job.jobTitle}</p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {[job.company, range(job.startDate, job.endDate, "Present")].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <None>No experience on the resume.</None>
      )}
    </GlassCard>
  );
}

function EducationCard({ p }: { p: PublicPortfolio }) {
  return (
    <GlassCard
      title="Education"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path d="M10 2 1 6.5l9 4.5 7-3.5V13h1.5V6.5L10 2Zm-5 8.3V14c0 1.4 2.2 3 5 3s5-1.6 5-3v-3.7l-5 2.5-5-2.5Z" />
        </svg>
      }
    >
      {p.education.length ? (
        <ol className="space-y-2.5 lg:[@media(max-height:820px)]:space-y-2">
          {p.education.slice(0, 2).map((e, i) => (
            <li key={i} className="border-l-2 border-brand-600/60 pl-3">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}</p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {[e.institution, range(e.startDate, e.endDate, "In progress")].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <None>No education on the resume.</None>
      )}
    </GlassCard>
  );
}

function ContactCard({ p }: { p: PublicPortfolio }) {
  const linkedin = p.linkedinUrl ? webUrl(p.linkedinUrl) : null;
  const website = p.websiteUrl ? webUrl(p.websiteUrl) : null;
  const rows: { label: string; value: string; href?: string | null }[] = [
    { label: "Email", value: p.email, href: p.email ? `mailto:${p.email}` : null },
    { label: "Phone", value: p.phone, href: p.phone ? `tel:${p.phone.replace(/[^\d+]/g, "")}` : null },
    { label: "Location", value: p.location },
    { label: "LinkedIn", value: p.linkedinUrl.replace(/^https?:\/\//, ""), href: linkedin },
    { label: "Website", value: p.websiteUrl.replace(/^https?:\/\//, ""), href: website },
  ].filter((r) => r.value);
  return (
    <GlassCard
      title="Contact Info"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path d="M3 4a2 2 0 0 0-2 2v.4l9 4.5 9-4.5V6a2 2 0 0 0-2-2H3Zm16 4.1-8.55 4.27a1 1 0 0 1-.9 0L1 8.1V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.1Z" />
        </svg>
      }
    >
      {rows.length ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm lg:[@media(max-height:820px)]:gap-y-0.5">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{r.label}</dt>
              <dd className="truncate text-neutral-800 dark:text-neutral-100">
                {r.href ? (
                  <a href={r.href} {...(r.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="hover:text-brand-600 hover:underline">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <None>No contact details on the resume.</None>
      )}
    </GlassCard>
  );
}

function ResumeCard({ p }: { p: PublicPortfolio }) {
  return (
    <GlassCard
      title="Resume"
      icon={
        <svg viewBox="0 0 20 20" fill="currentColor" className={ICON}>
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.03 8.22a.75.75 0 0 0-1.06 1.06l4.5 4.5a.75.75 0 0 0 1.06 0l4.5-4.5a.75.75 0 0 0-1.06-1.06l-3.22 3.22V2.75ZM3.5 14.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 19h10.5A2.75 2.75 0 0 0 18 16.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
        </svg>
      }
    >
      {p.resumeFileName ? (
        <div className="flex h-full flex-col justify-center gap-2">
          <a
            href={`/api/profile/public/${encodeURIComponent(p.userId)}/resume`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 font-display text-sm font-medium tracking-wider text-white uppercase shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:bg-brand-500"
          >
            Download Original Resume
          </a>
          <p className="truncate text-center text-xs text-neutral-500 dark:text-neutral-400">{p.resumeFileName}</p>
        </div>
      ) : (
        <None>No resume file to download.</None>
      )}
    </GlassCard>
  );
}
