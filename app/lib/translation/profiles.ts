import type { TranslationProvider } from "@/app/generated/prisma/client";
import {
  assertTranslationEncryptionConfigured,
  decryptTranslationCredential,
  encryptTranslationCredential,
} from "@/app/lib/translation/crypto";
import {
  createTranslationProfileRecord,
  findLatestProfileForSnapshot,
  getTranslationProfileByIdWithSecret,
  listTranslationProfiles,
  updateTranslationProfileRecord,
} from "@/app/lib/translation/data";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  parseCreateProfilePayload,
  parseUpdateProfilePayload,
} from "@/app/lib/translation/validation";

export async function listTranslationProfilesForDisplay(userId: string) {
  return listTranslationProfiles(userId);
}

export async function createTranslationProfile(payload: unknown, userId: string) {
  assertTranslationEncryptionConfigured();
  const parsed = parseCreateProfilePayload(payload);

  return createTranslationProfileRecord({
    provider: parsed.provider,
    model: parsed.model,
    baseUrl: parsed.baseUrl,
    encryptedApiKey: encryptTranslationCredential(parsed.apiKey),
    userId,
  });
}

export async function updateTranslationProfile(
  profileId: string,
  payload: unknown,
  userId: string
) {
  const parsed = parseUpdateProfilePayload(payload);
  const existing = await getTranslationProfileByIdWithSecret(profileId);
  if (!existing || existing.userId !== userId) {
    throw new TranslationHttpError(404, "Translation profile not found.");
  }

  const updateInput: {
    provider?: TranslationProvider;
    model?: string;
    baseUrl?: string | null;
    encryptedApiKey?: string;
  } = {};

  if (parsed.provider !== undefined) {
    updateInput.provider = parsed.provider;
  }
  if (parsed.model !== undefined) {
    updateInput.model = parsed.model;
  }
  if (parsed.baseUrl !== undefined) {
    updateInput.baseUrl = parsed.baseUrl;
  }
  if (parsed.apiKey !== undefined) {
    assertTranslationEncryptionConfigured();
    updateInput.encryptedApiKey = encryptTranslationCredential(parsed.apiKey);
  }

  return updateTranslationProfileRecord(profileId, updateInput);
}

export async function getTranslationProfileCredential(profileId: string, userId: string) {
  const profile = await getTranslationProfileByIdWithSecret(profileId);
  if (!profile || profile.userId !== userId) {
    throw new TranslationHttpError(404, "Translation profile not found.");
  }

  return {
    profileId: profile.id,
    provider: profile.provider,
    model: profile.model,
    baseUrl: profile.baseUrl,
    apiKey: decryptTranslationCredential(profile.encryptedApiKey),
  };
}

export async function getCredentialForTranslationSnapshot(
  provider: TranslationProvider,
  model: string,
  userId: string
) {
  const profile = await findLatestProfileForSnapshot(provider, model, userId);
  if (!profile) {
    throw new TranslationHttpError(
      400,
      `No profile found for ${provider} ${model}.`
    );
  }

  return {
    profileId: profile.id,
    provider: profile.provider,
    model: profile.model,
    baseUrl: profile.baseUrl,
    apiKey: decryptTranslationCredential(profile.encryptedApiKey),
  };
}
