import "dotenv/config";
import {
  TranslationProvider,
  TranslationStatus,
} from "@/app/generated/prisma/client";
import { createNovel } from "@/app/lib/novels";
import { prisma } from "@/app/lib/prisma";
import { getDownloadableTranslationJob } from "@/app/lib/translation/service";
import { TranslationHttpError } from "@/app/lib/translation/errors";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TEST_USER_ID = "export-route-test-user";

async function ensureTestUser() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: `export-route-test-${uniqueSuffix()}@test.local`,
      name: "Export Route Test User",
    },
  });
}

test("export service rejects unknown translation ids", async () => {
  await ensureTestUser();

  try {
    await getDownloadableTranslationJob(`missing-${uniqueSuffix()}`, TEST_USER_ID);
    expect.unreachable("Expected function to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TranslationHttpError);
    expect((error as TranslationHttpError).status).toBe(404);
  }
});

test("export service rejects translations without completed exports", async () => {
  await ensureTestUser();
  const suffix = uniqueSuffix();
  const novel = await createNovel({
    title: `Pending Export Novel ${suffix}`,
    originalFileName: `pending-${suffix}.txt`,
    fileType: "txt",
    mimeType: "text/plain",
    sizeBytes: 1,
    storagePath: `/tmp/pending-${suffix}.txt`,
    userId: TEST_USER_ID,
  });

  try {
    const pendingTranslation = await prisma.novelTranslation.create({
      data: {
        novelId: novel.id,
        targetLanguage: "Vietnamese",
        providerSnapshot: TranslationProvider.OPENAI,
        modelSnapshot: "gpt-test",
        status: TranslationStatus.PENDING,
        totalChapters: 1,
        completedChapters: 0,
        exportPath: null,
      },
    });

    try {
      await getDownloadableTranslationJob(pendingTranslation.id, TEST_USER_ID);
      expect.unreachable("Expected function to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationHttpError);
      expect((error as TranslationHttpError).status).toBe(404);
      expect((error as TranslationHttpError).message).toMatch(/not available/i);
    }
  } finally {
    await prisma.novel.deleteMany({
      where: { id: novel.id },
    });
  }
});

test("export service rejects access from non-owner", async () => {
  await ensureTestUser();
  const suffix = uniqueSuffix();
  const novel = await createNovel({
    title: `Owner Export Novel ${suffix}`,
    originalFileName: `owner-${suffix}.txt`,
    fileType: "txt",
    mimeType: "text/plain",
    sizeBytes: 1,
    storagePath: `/tmp/owner-${suffix}.txt`,
    userId: TEST_USER_ID,
  });

  try {
    const translation = await prisma.novelTranslation.create({
      data: {
        novelId: novel.id,
        targetLanguage: "Vietnamese",
        providerSnapshot: TranslationProvider.OPENAI,
        modelSnapshot: "gpt-test",
        status: TranslationStatus.COMPLETED,
        totalChapters: 1,
        completedChapters: 1,
        exportPath: `/tmp/export-${suffix}.txt`,
      },
    });

    try {
      await getDownloadableTranslationJob(translation.id, "other-user-id");
      expect.unreachable("Expected function to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationHttpError);
      expect((error as TranslationHttpError).status).toBe(404);
    }
  } finally {
    await prisma.novel.deleteMany({
      where: { id: novel.id },
    });
  }
});
