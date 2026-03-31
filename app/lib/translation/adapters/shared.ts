import { TranslationHttpError } from "@/app/lib/translation/errors";
import type {
  TranslateChapterInput,
  TranslateChapterOutput,
  DetectedTerm,
  GlossaryPromptEntry,
  ChapterContext,
} from "./types";

export type { GlossaryPromptEntry, ChapterContext };

export function buildTranslationSystemPrompt(
  targetLanguage: string,
  glossary?: GlossaryPromptEntry[]
) {
  const lines = [
    "You are an expert literary editor and translation polisher.",
    `The input is a machine-translated ${targetLanguage} novel chapter. Your job is to polish and improve the translation quality — NOT translate from scratch.`,
    "",
    "Fix these common machine-translation problems:",
    "- Awkward, unnatural, or overly literal phrasing → rewrite to read like native ${targetLanguage} prose",
    "- Inconsistent character names or terms → unify to the most natural form",
    "- Stilted dialogue → make it sound like real speech",
    "- Lost nuance, tone, or emotional impact → restore literary quality",
    "- Grammatical errors or broken sentences → fix while preserving meaning",
    "",
    "Preserve: narrative meaning, plot details, chapter structure, paragraph breaks, and formatting.",
    "Do NOT add, remove, or reorder content. Do NOT summarize or shorten.",
  ];

  if (glossary && glossary.length > 0) {
    lines.push("");
    lines.push("## Glossary");
    lines.push("Use the canonical term for any variant you encounter:");

    const confirmed = glossary.filter((g) => g.status === "confirmed");
    const pending = glossary.filter((g) => g.status === "pending");

    if (confirmed.length > 0) {
      lines.push("");
      lines.push("### Authoritative terms (always use these):");
      for (const entry of confirmed) {
        const variantStr = entry.variants.length > 0
          ? ` (variants: ${entry.variants.join(", ")})`
          : "";
        lines.push(`- ${entry.canonical} [${entry.type}]${variantStr}`);
      }
    }

    if (pending.length > 0) {
      lines.push("");
      lines.push("### Suggested terms (prefer these unless a better form exists):");
      for (const entry of pending) {
        const variantStr = entry.variants.length > 0
          ? ` (variants: ${entry.variants.join(", ")})`
          : "";
        lines.push(`- ${entry.canonical} [${entry.type}]${variantStr}`);
      }
    }
  }

  lines.push("");
  lines.push("Output valid JSON only with keys: translatedTitle, translatedContent, detectedTerms (optional array of {canonical, type, variants}), chapterSummary (optional ~100-200 word summary).");
  lines.push("Do not include markdown fences or extra commentary.");

  return lines.join("\n");
}

export function buildTranslationUserPrompt(
  input: TranslateChapterInput,
  previousContext?: ChapterContext[]
) {
  const lines: string[] = [];

  lines.push(`Target language: ${input.targetLanguage}`);
  lines.push("Task: Polish the machine-translated text below. Output the improved version.");

  if (previousContext && previousContext.length > 0) {
    lines.push("");
    lines.push("## Previous chapter context (for tone/name consistency — do not polish):");

    for (const ctx of previousContext) {
      lines.push("");
      lines.push(`### Chapter ${ctx.chapterIndex}:`);
      if (ctx.summary) {
        lines.push(`Summary: ${ctx.summary}`);
      }
      if (ctx.translatedContent) {
        lines.push(`Translated content (excerpt): ${ctx.translatedContent.slice(0, 2000)}`);
      }
    }
  }

  lines.push("");
  lines.push("Chapter title (polish this):");
  lines.push(input.sourceTitle);
  lines.push("");
  lines.push("Chapter content (polish this):");
  lines.push(input.sourceContent);

  return lines.join("\n");
}

export function parseTranslationPayload(payload: string): TranslateChapterOutput {
  const trimmed = payload.trim();
  const parsed = tryParseJsonPayload(trimmed) ?? tryParseEmbeddedJson(trimmed);

  if (!parsed || typeof parsed !== "object") {
    throw new TranslationHttpError(502, "Provider response did not contain JSON.");
  }

  const record = parsed as Record<string, unknown>;

  const translatedTitle = normalizeField(record.translatedTitle, "translatedTitle");
  const translatedContent = normalizeField(record.translatedContent, "translatedContent");

  const result: TranslateChapterOutput = {
    translatedTitle,
    translatedContent,
  };

  // Optional: extract detectedTerms
  if (Array.isArray(record.detectedTerms)) {
    const terms: DetectedTerm[] = [];
    for (const item of record.detectedTerms) {
      if (item && typeof item === "object") {
        const t = item as Record<string, unknown>;
        if (typeof t.canonical === "string" && t.canonical.trim()) {
          terms.push({
            canonical: t.canonical.trim(),
            type: typeof t.type === "string" ? t.type : undefined,
            variants: Array.isArray(t.variants)
              ? t.variants.filter((v): v is string => typeof v === "string")
              : undefined,
          });
        }
      }
    }
    if (terms.length > 0) {
      result.detectedTerms = terms;
    }
  }

  // Optional: extract chapterSummary
  if (typeof record.chapterSummary === "string" && record.chapterSummary.trim()) {
    result.chapterSummary = record.chapterSummary.trim();
  }

  return result;
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
