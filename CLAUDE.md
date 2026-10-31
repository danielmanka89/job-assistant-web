# CLAUDE.md

## Project

Job application assistant website. Users register, upload a resume, paste a job description, and get an AI gap analysis (matched keywords / missing keywords / suggested bullet points). They manually select which suggested bullets to accept, then download the tailored resume as .docx and .pdf.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development

## Non-negotiable rules

- Never commit `.env`.
- Hash passwords with bcrypt.
- Every API response must conform to the types in `lib/types.ts`.
- The AI must never fabricate experience, skills, dates, or metrics. It may only rephrase or reorder content the user provided.
- Suggested bullets are never auto-added. Only bullets the user explicitly selects are merged into the resume.

## Collaboration rules

- No direct commits to `main`.
- One phase = one branch = one PR = one tag.
- Only Daniel edits `lib/types.ts`.
