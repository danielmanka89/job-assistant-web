-- Mock call preparation: 50 AI-written interview questions and answers for one submission.
-- CreateTable
CREATE TABLE "MockCallPrep" (
    "submissionId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobDescription" TEXT,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockCallPrep_pkey" PRIMARY KEY ("submissionId")
);

-- AddForeignKey
ALTER TABLE "MockCallPrep" ADD CONSTRAINT "MockCallPrep_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
