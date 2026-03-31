import {
  TranslationProvider,
  type TranslationProvider as TranslationProviderType,
} from "@/app/generated/prisma/client";
import { TranslationHttpError } from "@/app/lib/translation/errors";

const SUPPORTED_PROVIDERS = new Set<TranslationProviderType>(
  Object.values(TranslationProvider)
);

const TARGET_LANGUAGE_PATTERN = /^[A-Za-z][A-Za-z\s\-]{1,63}$/;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TranslationHttpError(400, "Request payload must be an object.");
  }

  return value as Record<string, unknown>;
}

export function parseRequiredString(
  value: unknown,
  fieldName: string,
  minLength = 1,
  maxLength = 256
) {
  if (typeof value !== "string") {
    throw new TranslationHttpError(400, `${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new TranslationHttpError(
      400,
      `${fieldName} must be between ${minLength} and ${maxLength} characters.`
    );
  }

  return normalized;
}

export function parseOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = 512
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new TranslationHttpError(400, `${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new TranslationHttpError(
      400,
      `${fieldName} must be at most ${maxLength} characters.`
    );
  }

  return normalized;
}

export function parseProvider(value: unknown): TranslationProviderType {
  if (typeof value !== "string") {
    throw new TranslationHttpError(400, "provider is required.");
  }

  const normalized = value.trim().toUpperCase() as TranslationProviderType;
  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new TranslationHttpError(400, `Unsupported provider: ${value}`);
  }

  return normalized;
}

export function parseBaseUrl(value: unknown) {
  const normalized = parseOptionalString(value, "baseUrl");
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new TranslationHttpError(400, "baseUrl must be http(s).");
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new TranslationHttpError(400, "baseUrl must be a valid URL.");
  }
}

export function parseTargetLanguage(value: unknown) {
  const normalized = parseRequiredString(value, "targetLanguage", 2, 64);
  if (!TARGET_LANGUAGE_PATTERN.test(normalized)) {
    throw new TranslationHttpError(
      400,
      "targetLanguage may only contain letters, spaces, and hyphens."
    );
  }

  return normalized;
}

export function parseCreateProfilePayload(payload: unknown) {
  const body = asObject(payload);

  return {
    provider: parseProvider(body.provider),
    model: parseRequiredString(body.model, "model", 1, 160),
    baseUrl: parseBaseUrl(body.baseUrl),
    apiKey: parseRequiredString(body.apiKey, "apiKey", 1, 2048),
    customPrompt: parseOptionalString(body.customPrompt, "customPrompt", 4096),
  };
}

export function parseUpdateProfilePayload(payload: unknown) {
  const body = asObject(payload);

  const provider =
    body.provider === undefined ? undefined : parseProvider(body.provider);
  const model =
    body.model === undefined
      ? undefined
      : parseRequiredString(body.model, "model", 1, 160);
  const baseUrl =
    body.baseUrl === undefined ? undefined : parseBaseUrl(body.baseUrl);
  const apiKey =
    body.apiKey === undefined
      ? undefined
      : parseRequiredString(body.apiKey, "apiKey", 1, 2048);
  const customPrompt =
    body.customPrompt === undefined
      ? undefined
      : parseOptionalString(body.customPrompt, "customPrompt", 4096);

  if (
    provider === undefined &&
    model === undefined &&
    baseUrl === undefined &&
    apiKey === undefined &&
    customPrompt === undefined
  ) {
    throw new TranslationHttpError(
      400,
      "At least one profile field must be provided for update."
    );
  }

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    customPrompt,
  };
}

function parseChapterIndex(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new TranslationHttpError(400, `${fieldName} must be a positive integer.`);
  }
  return parsed;
}

export function parseStartTranslationPayload(payload: unknown) {
  const body = asObject(payload);

  return {
    profileId: parseRequiredString(body.profileId, "profileId", 1, 128),
    chapterFrom: body.chapterFrom !== undefined && body.chapterFrom !== null
      ? parseChapterIndex(body.chapterFrom, "chapterFrom")
      : undefined,
    chapterTo: body.chapterTo !== undefined && body.chapterTo !== null
      ? parseChapterIndex(body.chapterTo, "chapterTo")
      : undefined,
  };
}
