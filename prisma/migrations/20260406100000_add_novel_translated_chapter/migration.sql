-- CreateTable
CREATE TABLE "NovelTranslatedChapter" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "translatedTitle" TEXT NOT NULL,
    "translatedContent" TEXT NOT NULL,
    "summary" TEXT,
    "translationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelTranslatedChapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovelTranslatedChapter_novelId_chapterIndex_key" ON "NovelTranslatedChapter"("novelId", "chapterIndex");

-- CreateIndex
CREATE INDEX "NovelTranslatedChapter_novelId_idx" ON "NovelTranslatedChapter"("novelId");

-- AddForeignKey
ALTER TABLE "NovelTranslatedChapter" ADD CONSTRAINT "NovelTranslatedChapter_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelTranslatedChapter" ADD CONSTRAINT "NovelTranslatedChapter_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "NovelTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: populate from existing TRANSLATED chapters, latest wins per (novelId, chapterIndex)
INSERT INTO "NovelTranslatedChapter" ("id", "novelId", "chapterIndex", "translatedTitle", "translatedContent", "summary", "translationId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    t."novelId",
    c."chapterIndex",
    c."translatedTitle",
    c."translatedContent",
    c."summary",
    c."translationId",
    c."createdAt",
    c."updatedAt"
FROM (
    SELECT DISTINCT ON (t2."novelId", c2."chapterIndex")
        c2.*,
        t2."novelId" AS "joinNovelId"
    FROM "NovelTranslationChapter" c2
    INNER JOIN "NovelTranslation" t2 ON t2."id" = c2."translationId"
    WHERE c2."status" = 'TRANSLATED'
      AND c2."translatedContent" IS NOT NULL
      AND c2."translatedTitle" IS NOT NULL
    ORDER BY t2."novelId", c2."chapterIndex", c2."updatedAt" DESC
) c
INNER JOIN "NovelTranslation" t ON t."id" = c."translationId";
