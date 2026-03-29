import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
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

  await assert.rejects(
    () => getDownloadableTranslationJob(`missing-${uniqueSuffix()}`, TEST_USER_ID),
    (error) => {
      assert.ok(error instanceof TranslationHttpError);
      assert.equal(error.status, 404);
      return true;
    }
  );
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

    await assert.rejects(
      () => getDownloadableTranslationJob(pendingTranslation.id, TEST_USER_ID),
      (error) => {
        assert.ok(error instanceof TranslationHttpError);
        assert.equal(error.status, 404);
        assert.match(error.message, /not available/i);
        return true;
      }
    );
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

    await assert.rejects(
      () => getDownloadableTranslationJob(translation.id, "other-user-id"),
      (error) => {
        assert.ok(error instanceof TranslationHttpError);
        assert.equal(error.status, 404);
        return true;
      }
    );
  } finally {
    await prisma.novel.deleteMany({
      where: { id: novel.id },
    });
  }
});
