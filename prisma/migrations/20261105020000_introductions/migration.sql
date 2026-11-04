-- AI-written interview introductions, one per user, kept so they open instantly.
-- CreateTable
CREATE TABLE "Introduction" (
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "paragraphs" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Introduction_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

