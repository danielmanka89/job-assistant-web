-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "postedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPosting_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "JobPosting_createdAt_idx" ON "JobPosting"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_source_externalId_key" ON "JobPosting"("source", "externalId");
