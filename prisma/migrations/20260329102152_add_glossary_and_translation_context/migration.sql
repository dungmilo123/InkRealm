-- CreateEnum
CREATE TYPE "GlossaryEntryType" AS ENUM ('CHARACTER', 'PLACE', 'TECHNIQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "GlossaryEntryStatus" AS ENUM ('CONFIRMED', 'PENDING');

-- AlterTable
ALTER TABLE "NovelTranslation" ADD COLUMN     "contextChapters" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contextSummaries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "useGlossary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "NovelTranslationChapter" ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "NovelGlossaryEntry" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "type" "GlossaryEntryType" NOT NULL DEFAULT 'OTHER',
    "status" "GlossaryEntryStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelGlossaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelGlossaryVariant" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,

    CONSTRAINT "NovelGlossaryVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovelGlossaryEntry_novelId_status_idx" ON "NovelGlossaryEntry"("novelId", "status");

-- CreateIndex
CREATE INDEX "NovelGlossaryVariant_entryId_idx" ON "NovelGlossaryVariant"("entryId");

-- AddForeignKey
ALTER TABLE "NovelGlossaryEntry" ADD CONSTRAINT "NovelGlossaryEntry_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelGlossaryVariant" ADD CONSTRAINT "NovelGlossaryVariant_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "NovelGlossaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
