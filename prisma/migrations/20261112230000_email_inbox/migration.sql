-- Project email: each account's address name and the emails received at or sent from it.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "mailboxName" TEXT;

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "providerId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "preview" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "messageId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mailboxName_key" ON "User"("mailboxName");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_createdAt_idx" ON "EmailMessage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_userId_providerId_key" ON "EmailMessage"("userId", "providerId");

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
