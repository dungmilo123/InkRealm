import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/app/lib/prisma";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  createTranslationProfile,
  updateTranslationProfile,
} from "@/app/lib/translation/profiles";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TEST_USER_ID = "profiles-test-user";

async function ensureTestUser() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: `profiles-test-${uniqueSuffix()}@test.local`,
      name: "Profiles Test User",
    },
  });
}

test("profile create fails safely when encryption secret is missing", async () => {
  await ensureTestUser();
  const originalSecret = process.env.TRANSLATION_ENCRYPTION_SECRET;
  const model = `missing-secret-${uniqueSuffix()}`;

  delete process.env.TRANSLATION_ENCRYPTION_SECRET;

  try {
    await assert.rejects(
      async () => {
        await createTranslationProfile({
          provider: "OPENAI",
          model,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-missing-secret",
        }, TEST_USER_ID);
      },
      (error) => {
        assert.ok(error instanceof TranslationHttpError);
        assert.equal(error.status, 500);
        assert.match(error.message, /TRANSLATION_ENCRYPTION_SECRET is required/i);
        return true;
      }
    );
  } finally {
    if (originalSecret) {
      process.env.TRANSLATION_ENCRYPTION_SECRET = originalSecret;
    } else {
      delete process.env.TRANSLATION_ENCRYPTION_SECRET;
    }
  }

  const persistedCount = await prisma.translationProfile.count({
    where: { model },
  });
  assert.equal(persistedCount, 0);
});

test("profile update with apiKey fails safely when encryption secret is missing", async () => {
  await ensureTestUser();
  const originalSecret = process.env.TRANSLATION_ENCRYPTION_SECRET;
  const model = `update-missing-secret-${uniqueSuffix()}`;
  let createdProfileId: string | null = null;

  try {
    process.env.TRANSLATION_ENCRYPTION_SECRET = `profiles-test-secret-${uniqueSuffix()}`;

    const createdProfile = await createTranslationProfile({
      provider: "OPENAI",
      model,
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-before-update",
    }, TEST_USER_ID);
    createdProfileId = createdProfile.id;

    const before = await prisma.translationProfile.findUnique({
      where: { id: createdProfile.id },
      select: {
        encryptedApiKey: true,
      },
    });
    assert.ok(before);

    delete process.env.TRANSLATION_ENCRYPTION_SECRET;

    await assert.rejects(
      async () => {
        await updateTranslationProfile(createdProfile.id, {
          apiKey: "sk-after-update",
        }, TEST_USER_ID);
      },
      (error) => {
        assert.ok(error instanceof TranslationHttpError);
        assert.equal(error.status, 500);
        assert.match(error.message, /TRANSLATION_ENCRYPTION_SECRET is required/i);
        return true;
      }
    );

    const after = await prisma.translationProfile.findUnique({
      where: { id: createdProfile.id },
      select: {
        encryptedApiKey: true,
      },
    });
    assert.ok(after);
    assert.equal(after.encryptedApiKey, before.encryptedApiKey);
  } finally {
    if (createdProfileId) {
      await prisma.translationProfile.deleteMany({
        where: {
          id: createdProfileId,
        },
      });
    }

    if (originalSecret) {
      process.env.TRANSLATION_ENCRYPTION_SECRET = originalSecret;
    } else {
      delete process.env.TRANSLATION_ENCRYPTION_SECRET;
    }
  }
});
