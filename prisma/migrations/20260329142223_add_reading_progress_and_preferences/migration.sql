-- CreateEnum
CREATE TYPE "ReaderTheme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "ReaderFontFamily" AS ENUM ('SANS', 'SERIF');

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "lastChapterIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterVisit" (
    "id" TEXT NOT NULL,
    "readingProgressId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReadingPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fontSize" INTEGER NOT NULL DEFAULT 18,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.75,
    "theme" "ReaderTheme" NOT NULL DEFAULT 'LIGHT',
    "fontFamily" "ReaderFontFamily" NOT NULL DEFAULT 'SERIF',
    "maxWidth" INTEGER NOT NULL DEFAULT 720,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReadingPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_novelId_key" ON "ReadingProgress"("userId", "novelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterVisit_readingProgressId_chapterIndex_key" ON "ChapterVisit"("readingProgressId", "chapterIndex");

-- CreateIndex
CREATE UNIQUE INDEX "UserReadingPreferences_userId_key" ON "UserReadingPreferences"("userId");

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterVisit" ADD CONSTRAINT "ChapterVisit_readingProgressId_fkey" FOREIGN KEY ("readingProgressId") REFERENCES "ReadingProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReadingPreferences" ADD CONSTRAINT "UserReadingPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
