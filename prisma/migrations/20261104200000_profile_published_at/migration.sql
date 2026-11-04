-- Public portfolio: set when the candidate approves sharing; null keeps it private.
ALTER TABLE "CandidateProfile" ADD COLUMN     "publishedAt" TIMESTAMP(3);
