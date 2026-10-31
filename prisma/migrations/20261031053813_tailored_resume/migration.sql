-- CreateTable
CREATE TABLE "TailoredResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceResumeId" TEXT NOT NULL,
    "gapAnalysisId" TEXT NOT NULL,
    "acceptedBulletIds" JSONB NOT NULL,
    "contact" JSONB NOT NULL,
    "summary" TEXT,
    "workExperience" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TailoredResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TailoredResume_sourceResumeId_fkey" FOREIGN KEY ("sourceResumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TailoredResume_gapAnalysisId_fkey" FOREIGN KEY ("gapAnalysisId") REFERENCES "GapAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tailoredResumeId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedFile_tailoredResumeId_fkey" FOREIGN KEY ("tailoredResumeId") REFERENCES "TailoredResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TailoredResume_userId_idx" ON "TailoredResume"("userId");

-- CreateIndex
CREATE INDEX "GeneratedFile_userId_idx" ON "GeneratedFile"("userId");
