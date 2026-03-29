import { TranslationHttpError } from "@/app/lib/translation/errors";
import type { TranslateChapterInput, TranslateChapterOutput } from "./types";

export function buildTranslationSystemPrompt(targetLanguage: string) {
  return [
    "You are an expert literary translator.",
    `Translate chapter data into ${targetLanguage}.`,
    "Preserve narrative meaning, chapter structure, names, and formatting.",
    "Output valid JSON only with keys: translatedTitle, translatedContent.",
    "Do not include markdown fences or extra commentary.",
  ].join(" ");
}

export function buildTranslationUserPrompt(input: TranslateChapterInput) {
  return [
    `Target language: ${input.targetLanguage}`,
    "",
    "Chapter title:",
    input.sourceTitle,
    "",
    "Chapter content:",
    input.sourceContent,
  ].join("\n");
}

export function parseTranslationPayload(payload: string): TranslateChapterOutput {
  const trimmed = payload.trim();
  const parsed = tryParseJsonPayload(trimmed) ?? tryParseEmbeddedJson(trimmed);

  if (!parsed || typeof parsed !== "object") {
    throw new TranslationHttpError(502, "Provider response did not contain JSON.");
  }

  const translatedTitle = normalizeField(
    (parsed as Record<string, unknown>).translatedTitle,
    "translatedTitle"
  );
  const translatedContent = normalizeField(
    (parsed as Record<string, unknown>).translatedContent,
    "translatedContent"
  );

  return {
    translatedTitle,
    translatedContent,
  };
}

function tryParseJsonPayload(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryParseEmbeddedJson(value: string): unknown | null {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  return tryParseJsonPayload(match[0]);
}

function normalizeField(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new TranslationHttpError(502, `Provider response missing ${fieldName}.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new TranslationHttpError(502, `Provider response has empty ${fieldName}.`);
  }

  return trimmed;
}
