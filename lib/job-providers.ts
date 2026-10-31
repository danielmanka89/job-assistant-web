import { prisma } from "@/lib/db";
import type { JobSource } from "@/lib/types";

/** A job as returned by an external provider, before it is stored. */
export interface ExternalJob {
  externalId: string; // the provider's own id, used to update the same row on later syncs
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
}

interface JobProvider {
  source: Exclude<JobSource, "native">;
  fetchJobs(): Promise<ExternalJob[]>;
}

// Demo data so the job board works without provider API keys. Companies are made up and every
// apply link points at example.com, so these can't be mistaken for real openings.
const MOCK_JOBS: ExternalJob[] = [
  {
    externalId: "mock-1",
    title: "Junior Python Developer",
    company: "Brightline Analytics (demo)",
    location: "Berlin, Germany",
    description:
      "Join our data platform team building internal tools in Python. You will write and test FastAPI services, work with PostgreSQL, and help automate data pipelines.\n\nRequirements: 1+ years of Python, basic SQL, Git, and an interest in testing with Pytest. Nice to have: Docker, AWS.",
    applyUrl: "https://example.com/jobs/mock-1",
  },
  {
    externalId: "mock-2",
    title: "Frontend Engineer (React)",
    company: "Cobalt Harbor Systems (demo)",
    location: "Remote (EU)",
    description:
      "We are looking for a frontend engineer to own our customer dashboard. You will build accessible React and TypeScript components, work closely with designers, and improve page performance.\n\nRequirements: 3+ years of React, TypeScript, CSS, REST APIs. Nice to have: Next.js, Tailwind, testing with Playwright.",
    applyUrl: "https://example.com/jobs/mock-2",
  },
  {
    externalId: "mock-3",
    title: "Machine Learning Engineer",
    company: "Fernway Health Tech (demo)",
    location: "Munich, Germany",
    description:
      "Help us bring ML models for clinical forecasting into production. You will train and evaluate models in Python (scikit-learn, PyTorch), package them as services, and monitor them in production.\n\nRequirements: 3+ years in ML engineering, Python, NumPy, pandas, model deployment with Docker. Nice to have: healthcare data experience, MLflow.",
    applyUrl: "https://example.com/jobs/mock-3",
  },
  {
    externalId: "mock-4",
    title: "DevOps Engineer",
    company: "Quarrystone Cloud (demo)",
    location: "Hamburg, Germany",
    description:
      "Own our CI/CD and cloud infrastructure. You will maintain Jenkins and GitHub Actions pipelines, manage AWS with Terraform and CloudFormation, and improve observability.\n\nRequirements: AWS, Docker, Kubernetes, Linux, scripting in Bash or Python. Nice to have: Puppet or Ansible, Prometheus, Grafana.",
    applyUrl: "https://example.com/jobs/mock-4",
  },
  {
    externalId: "mock-5",
    title: "Backend Engineer (Node.js)",
    company: "Lumen Parcel (demo)",
    location: "Remote",
    description:
      "Build the APIs behind our delivery tracking platform. You will design REST and event-driven services in Node.js and TypeScript, model data in PostgreSQL, and keep services secure and fast.\n\nRequirements: 3+ years Node.js, TypeScript, SQL, authentication with OAuth/JWT. Nice to have: Kafka, Redis, GraphQL.",
    applyUrl: "https://example.com/jobs/mock-5",
  },
  {
    externalId: "mock-6",
    title: "Data Analyst",
    company: "Tidewater Retail Group (demo)",
    location: "Frankfurt, Germany",
    description:
      "Turn sales and customer data into decisions. You will build dashboards, write SQL, and present findings to business teams.\n\nRequirements: strong SQL, Excel, a BI tool such as Power BI or Tableau, and clear communication. Nice to have: Python with pandas, A/B testing experience.",
    applyUrl: "https://example.com/jobs/mock-6",
  },
  {
    externalId: "mock-7",
    title: "Full Stack Developer (Django + React)",
    company: "Orchard Learning (demo)",
    location: "Cologne, Germany",
    description:
      "Work across our e-learning platform: Django REST APIs on the backend and React on the frontend. You will ship features end to end and take part in code reviews.\n\nRequirements: Python, Django, React, JavaScript, SQL, Git. Nice to have: Celery, Docker, experience with education products.",
    applyUrl: "https://example.com/jobs/mock-7",
  },
  {
    externalId: "mock-8",
    title: "QA Automation Engineer",
    company: "Pinecrest Fintech (demo)",
    location: "Remote (Germany)",
    description:
      "Build and maintain automated tests for our payments apps. You will write API and UI tests, run them in CI, and work with developers to prevent regressions.\n\nRequirements: test automation with Pytest or Jest, Selenium or Playwright, CI pipelines, API testing. Nice to have: performance testing, fintech experience.",
    applyUrl: "https://example.com/jobs/mock-8",
  },
  {
    externalId: "mock-9",
    title: "Cloud Solutions Architect",
    company: "Silverpine Consulting (demo)",
    location: "Stuttgart, Germany",
    description:
      "Design cloud architectures for enterprise clients and guide migrations to AWS. You will lead technical workshops, write architecture documents, and support delivery teams.\n\nRequirements: 5+ years in cloud engineering, AWS certification, networking and security fundamentals. Nice to have: Azure, cost optimization.",
    applyUrl: "https://example.com/jobs/mock-9",
  },
  {
    externalId: "mock-10",
    title: "Software Engineer, Mobile (React Native)",
    company: "Wayfarer Transit (demo)",
    location: "Leipzig, Germany",
    description:
      "Build our passenger app for iOS and Android with React Native. You will implement new screens, integrate with REST APIs, and improve app stability.\n\nRequirements: React Native, TypeScript, REST APIs, publishing to app stores. Nice to have: offline sync, push notifications, accessibility.",
    applyUrl: "https://example.com/jobs/mock-10",
  },
];

const mockProvider: JobProvider = {
  source: "mock",
  fetchJobs: async () => MOCK_JOBS,
};

/** EXTERNAL_JOBS_PROVIDER=mock (default) or none. Adzuna can be added here as another JobProvider. */
function activeProviders(): JobProvider[] {
  const setting = (process.env.EXTERNAL_JOBS_PROVIDER ?? "mock").trim().toLowerCase();
  return setting === "mock" ? [mockProvider] : [];
}

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let lastSync = 0;
let inflight: Promise<void> | null = null;

/** Stores the latest external jobs, at most once per SYNC_INTERVAL_MS. A failed provider is logged and skipped. */
export function syncExternalJobs(): Promise<void> {
  if (Date.now() - lastSync < SYNC_INTERVAL_MS) return Promise.resolve();
  inflight ??= (async () => {
    for (const provider of activeProviders()) {
      try {
        const jobs = await provider.fetchJobs();
        await prisma.$transaction(
          jobs.map(({ externalId, ...fields }) =>
            prisma.jobPosting.upsert({
              where: { source_externalId: { source: provider.source, externalId } },
              create: { ...fields, source: provider.source, externalId },
              update: fields,
            }),
          ),
        );
      } catch (error) {
        console.error(`syncing ${provider.source} jobs failed`, error);
      }
    }
    lastSync = Date.now();
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
