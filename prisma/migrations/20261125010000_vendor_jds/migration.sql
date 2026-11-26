-- My JDs: job descriptions vendors send the user directly. Additive only.
CREATE TABLE "VendorJd" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "rate" TEXT NOT NULL DEFAULT '',
    "vendorCompany" TEXT NOT NULL DEFAULT '',
    "vendorContact" TEXT NOT NULL DEFAULT '',
    "vendorEmail" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "jobDescription" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT NOT NULL DEFAULT '',
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorJd_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VendorJd_submissionId_key" ON "VendorJd"("submissionId");
CREATE INDEX "VendorJd_userId_createdAt_idx" ON "VendorJd"("userId", "createdAt");
ALTER TABLE "VendorJd" ADD CONSTRAINT "VendorJd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorJd" ADD CONSTRAINT "VendorJd_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
