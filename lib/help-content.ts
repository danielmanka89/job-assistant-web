// How-to guides for the app: shown in Settings › Help Center, and given to the help assistant as the
// only facts it may answer from (app/api/help/chat). Keep them true to the app — when a page changes,
// change its guide here too. No server-only imports.

export type HelpCategory = "Getting started" | "Resume" | "Jobs & applying" | "Growing" | "People & messages" | "Account";

export const HELP_CATEGORIES: HelpCategory[] = ["Getting started", "Resume", "Jobs & applying", "Growing", "People & messages", "Account"];

export interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  /** Extra words people might search for. */
  keywords: string;
  /** Short paragraphs; lines starting with "1." etc. are steps. */
  body: string[];
  /** The page it's about, for a "Go there" link. */
  href?: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "what-is-this",
    title: "What JobAssistant does",
    category: "Getting started",
    keywords: "about overview introduction start new",
    body: [
      "JobAssistant helps you apply to jobs with a resume tailored to each one. You upload your resume once, compare it with a job description, accept suggested improvements, and download a tailored Word or PDF copy.",
      "It also keeps track of every application in a Spreadsheet, prepares you for interview calls, reminds you of deadlines, suggests skills to learn, and lets you message people and use your own project email address.",
      "Everything is in the menu on the left (on phones and small windows, tap the menu button at the top).",
    ],
    href: "/dashboard",
  },
  {
    id: "first-steps",
    title: "Your first tailored resume, step by step",
    category: "Getting started",
    keywords: "steps flow how to begin tailor workflow stepper",
    body: [
      "Tailoring takes four steps, shown at the top of the page: Upload resume, Review details, Job description, Download.",
      "1. Upload your resume (PDF or Word .docx, up to 10 MB).",
      "2. Review what was read from it and fix anything that's off.",
      "3. Paste a job description (or pick a job from the Job Board) to see which keywords you cover and which are missing, and accept the suggested bullet rewrites you agree with.",
      "4. Compare the tailored version with your original and download it as Word or PDF.",
    ],
    href: "/dashboard/upload",
  },
  {
    id: "dashboard",
    title: "The dashboard",
    category: "Getting started",
    keywords: "home stats today this week this month open jobs tailored count quote clocks",
    body: [
      "The dashboard shows your numbers at a glance: resumes tailored, jobs applied today, this week (since Monday) and this month, and how many jobs are open on the board.",
      "Below them are My Resumes (each tailored resume with its match score and Word / PDF downloads) and Recent chats: your three latest conversations, with unread counts. Click a chat to open it.",
      "The sidebar shows Pacific, Central and Eastern time, and a motivational quote runs along the bottom of the screen.",
    ],
    href: "/dashboard",
  },
  {
    id: "upload",
    title: "Uploading your resume",
    category: "Resume",
    keywords: "upload file pdf docx word size error replace update new resume",
    body: [
      "Open Upload resume and drop in a PDF or Word (.docx) file up to 10 MB. Your experience, education, skills and contact details are read from it automatically.",
      "To update your details later, upload a newer resume. Your profile is filled in from your resume, so adding missing details to the resume and uploading it again is the way to change them.",
      "If a file is rejected, check it's a real PDF or .docx (not a scan saved as an image, and not .doc), and under 10 MB.",
    ],
    href: "/dashboard/upload",
  },
  {
    id: "review",
    title: "Reviewing what was read from your resume",
    category: "Resume",
    keywords: "review edit fix details wrong dates skills experience",
    body: [
      "After uploading, the Review page shows what was pulled from your file: contact details, summary, work experience, education and skills. Fix anything that's wrong before matching jobs, because these details are what get compared with job descriptions.",
      "Nothing is invented: only what your resume says is used.",
    ],
    href: "/dashboard/review",
  },
  {
    id: "match",
    title: "Matching a job description",
    category: "Resume",
    keywords: "analyze match job description keywords missing gap score percent bullets suggestions summary",
    body: [
      "Paste a job description on the Match a job step. You'll see which of its keywords your resume already covers, which it's missing, and a match score.",
      "You also get suggested rewrites of your existing bullets with clearer wording. Accept only the ones you agree with; nothing is added that you didn't write. You can also generate summary options and add missing skills you really have.",
    ],
    href: "/dashboard/analyze",
  },
  {
    id: "download",
    title: "Downloading your tailored resume",
    category: "Resume",
    keywords: "download word pdf docx compare original tailored file",
    body: [
      "On the Download step, compare the tailored resume with your original, then download it as a Word document (.docx) or a PDF. The dashboard's Resumes Tailored count goes up each time.",
    ],
    href: "/dashboard/download",
  },
  {
    id: "job-board",
    title: "Finding jobs on the Job Board",
    category: "Jobs & applying",
    keywords: "job board search find roles apply tailor one click listing why should i hire you pitch answer 300 words full time c2c w2 contract corp to corp type filter tabs posted recent new last 24 hours 48 hours week month date color colour status applied under review approved rejected green red amber blue",
    body: [
      "Next to the search box, the Filters button opens a menu with two sections. Type splits positions into All, Full Time, C2C and W2; Posted shows only jobs posted in the last 24 hours, 48 hours, week or month. Each choice shows how many jobs it has, the button shows the filters that are on, and Clear filters resets them. Filters and search work together.",
      "C2C means a corp-to-corp contract and W2 a contract on the employer's or vendor's payroll. A job open to more than one type shows under each.",
      "The Job Board shows each job on one row: a small status icon on the left, the role in the middle (title, company, location, when it was posted), and Tailor and Apply on the right. Click a job's title to open its full description. Tailor tailors your resume to it in one click: the job description comes with you, so you skip pasting it.",
      "Each job has a \"Why should I hire you?\" box under its description. Write your answer there (up to 300 words; the counter shows how many you've used) and press Save. It's kept for that job, and the job shows \"Pitch ✓\" once it's saved. Save it empty to remove it.",
      "Applying to a job adds it to your Spreadsheet automatically, filled in from the job, your profile and your latest resume.",
      "The status icon follows the Status on the job's Spreadsheet row: a blue paper plane means you applied, an amber clock means it's under review (Submitted to vendor or On hold), a green check means it's moving ahead (Submitted to client, Interview, Offer or Placed), and a grey box means it's closed. A dashed briefcase means you haven't applied yet. Hover over an icon to see what it means; change the Status in your Spreadsheet and the icon follows.",
    ],
    href: "/dashboard/jobs",
  },
  {
    id: "spreadsheet",
    title: "Tracking applications in the Spreadsheet",
    category: "Jobs & applying",
    keywords: "spreadsheet tracker applications excel export vendor submission client skills status interview date",
    body: [
      "Every job you apply to is added to the Spreadsheet automatically. It has four sheets: Vendor Information, Submission Details, Skill Matrix and Client Information. You can also add rows by hand.",
      "Keep the Status and dates up to date: the Interview Date and Submission Date feed your deadline tracker. Download everything as an Excel file at any time.",
    ],
    href: "/dashboard/spreadsheet",
  },
  {
    id: "mock-call-prep",
    title: "Preparing for an interview call",
    category: "Jobs & applying",
    keywords: "mock call prep interview questions answers prepare practice",
    body: [
      "In the Spreadsheet's Submission Details sheet, each row has a Prepare link. It opens Mock Call Prep: about 50 likely interview questions for that job, with suggested answers based on your resume.",
    ],
    href: "/dashboard/spreadsheet",
  },
  {
    id: "deadlines",
    title: "The deadline tracker",
    category: "Jobs & applying",
    keywords: "deadline tracker reminders follow up interview countdown pending timeline tabs board add deadline",
    body: [
      "The card at the bottom of the sidebar counts down to your next deadline. Hover over it (or tap it) to open the full list.",
      "It collects upcoming interviews (from the Interview Date in your Spreadsheet), follow-up reminders (applications still marked Applied or Submitted a week after you applied), learning paths you've started, and deadlines you add yourself.",
      "Switch between Timeline, Tabs and Board views at the top of the panel. Add your own deadline at the bottom; tick it when it's done or delete it.",
    ],
  },
  {
    id: "employer",
    title: "Posting a job (employers)",
    category: "Jobs & applying",
    keywords: "employer post job hiring recruiter listing",
    body: [
      "Employer accounts have Post a Job in the menu. A posted job appears on the Job Board, where candidates can tailor their resume to it in one click and then apply through your link.",
      "When posting, choose the position type: Full Time, C2C, W2, or any combination you'd accept. Candidates filter the Job Board by these, and applying to a single-type job fills in Employment Type in their Spreadsheet.",
    ],
    href: "/dashboard/employer",
  },
  {
    id: "learning",
    title: "Learning new skills",
    category: "Growing",
    keywords: "learning skills roadmap lessons certifications practice market reach progress",
    body: [
      "Learning suggests skills that would help you reach more employers. Each skill has a roadmap, lessons, certifications and practice.",
      "Start a learning path and tick off roadmap steps as you go; your progress shows on the path and in the deadline tracker.",
    ],
    href: "/dashboard/learning",
  },
  {
    id: "profile",
    title: "My Profile and your public portfolio",
    category: "Growing",
    keywords: "profile portfolio public share link market reach add to resume",
    body: [
      "My Profile is filled in from your resume and used automatically every time you apply or tailor. To change it, add the missing details to your resume or upload an updated one.",
      "View Public Portfolio lets you share a public page about yourself. You approve sharing first; until then it stays private.",
    ],
    href: "/dashboard/profile",
  },
  {
    id: "chat",
    title: "Chat and connections",
    category: "People & messages",
    keywords: "chat message connect connections friends recruiters vendors unread",
    body: [
      "Chat lets you connect with friends, vendors, employers and recruiters, and message the people you're connected with.",
      "Your account card in the sidebar shows how many people you're connected to and how many are connected to you. Unread messages show as a number next to Chat in the menu.",
    ],
    href: "/dashboard/chat",
  },
  {
    id: "inbox",
    title: "Your project email Inbox",
    category: "People & messages",
    keywords: "inbox email address send receive reply mail",
    body: [
      "Inbox gives you your own email address for this site. Use it when you apply or post a job, and the replies arrive here instead of in your personal mailbox. You can send and reply from it too.",
      "Emails are shown as plain text for safety. If the Inbox says email isn't set up yet, the site's email service hasn't been configured by the administrators.",
    ],
    href: "/dashboard/inbox",
  },
  {
    id: "settings",
    title: "Settings: appearance, photos and account",
    category: "Account",
    keywords: "settings theme dark light black white color photo avatar name email password clocks",
    body: [
      "In Settings you can choose Light, Dark or Black & White appearance, a theme color (Blue, the default, Green or Red), and the style of the dashboard clocks. The theme color sets the background gradient, the menu and every button, around the app's framed window.",
      "You can also set your portfolio photo and a separate menu photo, and change your name, the email you sign in with, and your password.",
    ],
    href: "/dashboard/settings",
  },
  {
    id: "sign-in",
    title: "Signing in and out",
    category: "Account",
    keywords: "login sign in sign out logout password forgot account create register",
    body: [
      "Create an account as a Job Seeker or an Employer, then sign in with your email and password. Sign out from the sidebar.",
      "To change your password, go to Settings. If you can't sign in, check the email you registered with and your password's capital letters.",
    ],
  },
];

/** The guides as plain text for the help assistant's instructions. */
export function helpGuideText(): string {
  return HELP_ARTICLES.map((a) => `## ${a.title}${a.href ? ` (page: ${a.href})` : ""}\n${a.body.join("\n")}`).join("\n\n");
}

/** Articles matching a search, best first; all of them for an empty search. */
export function searchHelp(query: string): HelpArticle[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return HELP_ARTICLES;
  return HELP_ARTICLES.map((article) => {
    const title = article.title.toLowerCase();
    const rest = `${article.keywords} ${article.body.join(" ")}`.toLowerCase();
    const score = words.reduce((sum, w) => sum + (title.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0), 0);
    return { article, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);
}

/** A name for the page someone is on, so the assistant knows where they are. */
export function pageName(path: string): string | null {
  const match = HELP_ARTICLES.filter((a) => a.href && (path === a.href || path.startsWith(`${a.href}/`))).sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return match ? `${match.title} (${path})` : null;
}
