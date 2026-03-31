import type { TranslationProvider } from "@/app/generated/prisma/client";
import {
  assertTranslationEncryptionConfigured,
  decryptTranslationCredential,
  encryptTranslationCredential,
} from "@/app/lib/translation/crypto";
import {
  createTranslationProfileRecord,
  deleteTranslationProfileRecord,
  findLatestProfileForSnapshot,
  getDefaultTranslationProfile,
  getTranslationProfileByIdWithSecret,
  listTranslationProfiles,
  setDefaultTranslationProfileRecord,
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

  const existing = await listTranslationProfiles(userId);
  const isFirstProfile = existing.length === 0;

  return createTranslationProfileRecord({
    provider: parsed.provider,
    model: parsed.model,
    baseUrl: parsed.baseUrl,
    customPrompt: parsed.customPrompt,
    encryptedApiKey: encryptTranslationCredential(parsed.apiKey),
    isDefault: isFirstProfile,
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
    customPrompt?: string | null;
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
  if (parsed.customPrompt !== undefined) {
    updateInput.customPrompt = parsed.customPrompt;
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
    customPrompt: profile.customPrompt,
    apiKey: decryptTranslationCredential(profile.encryptedApiKey),
  };
}

export async function deleteTranslationProfile(profileId: string, userId: string) {
  const deleted = await deleteTranslationProfileRecord(profileId, userId);
  if (!deleted) {
    throw new TranslationHttpError(404, "Translation profile not found.");
  }
  return deleted;
}

export async function setDefaultProfile(profileId: string, userId: string) {
  const existing = await getTranslationProfileByIdWithSecret(profileId);
  if (!existing || existing.userId !== userId) {
    throw new TranslationHttpError(404, "Translation profile not found.");
  }
  return setDefaultTranslationProfileRecord(profileId, userId);
}

export async function getDefaultProfile(userId: string) {
  return getDefaultTranslationProfile(userId);
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
    customPrompt: profile.customPrompt,
    apiKey: decryptTranslationCredential(profile.encryptedApiKey),
  };
}
