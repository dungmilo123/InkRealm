import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import {
  TranslationProvider,
  TranslationStatus,
} from "@/app/generated/prisma/client";
import { createNovel } from "@/app/lib/novels";
import { prisma } from "@/app/lib/prisma";
import { GET as getTranslationExport } from "@/app/api/translation/jobs/[translationId]/export/route";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJsonError(response: Response) {
  const payload = (await response.json()) as { error?: string };
  return payload.error ?? "unknown-error";
}

test("export route rejects unknown translation ids", async () => {
  const response = await getTranslationExport(new Request("http://localhost"), {
    params: Promise.resolve({
      translationId: `missing-${uniqueSuffix()}`,
    }),
  });

  assert.equal(response.status, 404);
  assert.equal(await readJsonError(response), "Translation job not found.");
});

test("export route rejects translations without completed exports", async () => {
  const suffix = uniqueSuffix();
  const novel = await createNovel({
    title: `Pending Export Novel ${suffix}`,
    originalFileName: `pending-${suffix}.txt`,
    fileType: "txt",
    mimeType: "text/plain",
    sizeBytes: 1,
    storagePath: `/tmp/pending-${suffix}.txt`,
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

    const response = await getTranslationExport(new Request("http://localhost"), {
      params: Promise.resolve({
        translationId: pendingTranslation.id,
      }),
    });

    assert.equal(response.status, 404);
    assert.equal(await readJsonError(response), "Translation export is not available.");
  } finally {
    await prisma.novel.deleteMany({
      where: {
        id: novel.id,
      },
    });
  }
});

test("export route returns bounded not-found when export file is missing", async () => {
  const suffix = uniqueSuffix();
  const novel = await createNovel({
    title: `Missing Export Novel ${suffix}`,
    originalFileName: `missing-${suffix}.txt`,
    fileType: "txt",
    mimeType: "text/plain",
    sizeBytes: 1,
    storagePath: `/tmp/missing-${suffix}.txt`,
  });

  try {
    const completedTranslation = await prisma.novelTranslation.create({
      data: {
        novelId: novel.id,
        targetLanguage: "Vietnamese",
        providerSnapshot: TranslationProvider.OPENAI,
        modelSnapshot: "gpt-test",
        status: TranslationStatus.COMPLETED,
        totalChapters: 1,
        completedChapters: 1,
        exportPath: `/tmp/non-existent-export-${suffix}.txt`,
      },
    });

    const response = await getTranslationExport(new Request("http://localhost"), {
      params: Promise.resolve({
        translationId: completedTranslation.id,
      }),
    });

    assert.equal(response.status, 404);
    assert.equal(await readJsonError(response), "Translation export file was not found.");
  } finally {
    await prisma.novel.deleteMany({
      where: {
        id: novel.id,
      },
    });
  }
});
