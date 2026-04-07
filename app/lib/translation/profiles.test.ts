import "dotenv/config";
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
    try {
        await createTranslationProfile({
          provider: "OPENAI",
          model,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-missing-secret",
        }, TEST_USER_ID);
        expect.unreachable("Expected function to throw");
    } catch (error) {
        expect(error).toBeInstanceOf(TranslationHttpError);
        expect((error as TranslationHttpError).status).toBe(500);
        expect((error as TranslationHttpError).message).toMatch(/TRANSLATION_ENCRYPTION_SECRET is required/i);
        }
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
  expect(persistedCount).toBe(0);
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
    expect(before).toBeTruthy();

    delete process.env.TRANSLATION_ENCRYPTION_SECRET;

    try {
        await updateTranslationProfile(createdProfile.id, {
          apiKey: "sk-after-update",
        }, TEST_USER_ID);
        expect.unreachable("Expected function to throw");
    } catch (error) {
        expect(error).toBeInstanceOf(TranslationHttpError);
        expect((error as TranslationHttpError).status).toBe(500);
        expect((error as TranslationHttpError).message).toMatch(/TRANSLATION_ENCRYPTION_SECRET is required/i);
        }

    const after = await prisma.translationProfile.findUnique({
      where: { id: createdProfile.id },
      select: {
        encryptedApiKey: true,
      },
    });
    expect(after).toBeTruthy();
    expect(after.encryptedApiKey).toBe(before.encryptedApiKey);
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
