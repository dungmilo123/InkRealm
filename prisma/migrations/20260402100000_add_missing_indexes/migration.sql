-- AddMissingIndexes
-- Adds indexes on foreign key columns that are frequently queried
-- but were missing indexes, causing full table scans.

-- Novel: listNovels(userId) with orderBy createdAt desc (dashboard page)
CREATE INDEX "Novel_userId_createdAt_idx" ON "Novel"("userId", "createdAt");

-- TranslationProfile: listTranslationProfiles(userId), getDefaultTranslationProfile(userId)
CREATE INDEX "TranslationProfile_userId_idx" ON "TranslationProfile"("userId");

-- TranslationProfile: findLatestProfileForSnapshot(provider, model, userId)
CREATE INDEX "TranslationProfile_provider_model_userId_idx" ON "TranslationProfile"("provider", "model", "userId");

-- NovelTranslation: countChapterTranslationStats filters by novelId + status
CREATE INDEX "NovelTranslation_novelId_status_idx" ON "NovelTranslation"("novelId", "status");

-- Account: Auth.js internal queries + unlink-google deleteMany(userId, provider)
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- Session: Auth.js internal queries by userId for session management
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
