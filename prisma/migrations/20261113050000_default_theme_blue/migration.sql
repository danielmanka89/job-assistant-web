-- Blue Glass: new accounts start with the blue theme color. Existing accounts keep their choice.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clockColor" SET DEFAULT 'BLUE';
