-- Chat presence (ON while the app is open) and the profile ring color. Additive only.
ALTER TABLE "User" ADD COLUMN "ringStyle" TEXT NOT NULL DEFAULT 'PRISM';
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
