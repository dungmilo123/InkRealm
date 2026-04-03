-- CreateEnum
CREATE TYPE "ReaderTextAlign" AS ENUM ('LEFT', 'JUSTIFY');

-- CreateEnum
CREATE TYPE "ReaderParagraphSpacing" AS ENUM ('COMPACT', 'NORMAL', 'RELAXED');

-- AlterTable
ALTER TABLE "UserReadingPreferences" ADD COLUMN "textAlign" "ReaderTextAlign" NOT NULL DEFAULT 'LEFT';
ALTER TABLE "UserReadingPreferences" ADD COLUMN "paragraphSpacing" "ReaderParagraphSpacing" NOT NULL DEFAULT 'NORMAL';
