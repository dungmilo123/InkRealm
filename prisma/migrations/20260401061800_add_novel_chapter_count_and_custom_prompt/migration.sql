-- AlterEnum
ALTER TYPE "TranslationStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Novel" ADD COLUMN "chapterCount" INTEGER;

-- AlterTable
ALTER TABLE "TranslationProfile" ADD COLUMN "customPrompt" TEXT;
