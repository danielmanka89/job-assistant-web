-- CreateTable
CREATE TABLE "GapAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "matchedKeywords" JSONB NOT NULL,
    "missingKeywords" JSONB NOT NULL,
    "suggestedBullets" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GapAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GapAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GapAnalysis_userId_idx" ON "GapAnalysis"("userId");

-- CreateIndex
CREATE INDEX "GapAnalysis_resumeId_idx" ON "GapAnalysis"("resumeId");
