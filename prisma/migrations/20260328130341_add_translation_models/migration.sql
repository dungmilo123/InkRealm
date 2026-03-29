-- CreateEnum
CREATE TYPE "TranslationProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'OPENROUTER');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChapterTranslationStatus" AS ENUM ('PENDING', 'TRANSLATING', 'TRANSLATED', 'FAILED');

-- CreateTable
CREATE TABLE "TranslationProfile" (
    "id" TEXT NOT NULL,
    "provider" "TranslationProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "encryptedApiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelTranslation" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "providerSnapshot" "TranslationProvider" NOT NULL,
    "modelSnapshot" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "completedChapters" INTEGER NOT NULL DEFAULT 0,
    "failedChapterIndex" INTEGER,
    "failureReason" TEXT,
    "exportPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelTranslationChapter" (
    "id" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "status" "ChapterTranslationStatus" NOT NULL DEFAULT 'PENDING',
    "originalTitle" TEXT NOT NULL,
    "translatedTitle" TEXT,
    "translatedContent" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelTranslationChapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovelTranslationChapter_translationId_chapterIndex_key" ON "NovelTranslationChapter"("translationId", "chapterIndex");

-- AddForeignKey
ALTER TABLE "NovelTranslation" ADD CONSTRAINT "NovelTranslation_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelTranslationChapter" ADD CONSTRAINT "NovelTranslationChapter_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "NovelTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
