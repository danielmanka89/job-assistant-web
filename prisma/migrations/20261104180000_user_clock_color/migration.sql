-- Dashboard clock color picked in Settings (Red keeps the existing look).
ALTER TABLE "User" ADD COLUMN     "clockColor" TEXT NOT NULL DEFAULT 'RED';
