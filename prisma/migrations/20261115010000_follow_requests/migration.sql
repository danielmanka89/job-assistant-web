-- Follow requests: a connection is "pending" until the person followed accepts it. Existing rows stay accepted.
ALTER TABLE "Connection" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'accepted';
CREATE INDEX "Connection_toUserId_status_idx" ON "Connection"("toUserId", "status");

-- Personal invite links.
ALTER TABLE "User" ADD COLUMN "inviteCode" TEXT;
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");
