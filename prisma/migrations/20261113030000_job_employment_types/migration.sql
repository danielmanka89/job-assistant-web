-- Job Board employment types (Full-time, C2C, W2). Existing rows keep an empty list and have their
-- types read from the description until they're saved again.
-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
