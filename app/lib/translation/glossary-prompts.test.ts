import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  parseTranslationPayload,
} from "@/app/lib/translation/adapters/shared";
import type { GlossaryPromptEntry, ChapterContext } from "@/app/lib/translation/adapters/types";

// 9.2 Test prompt construction with glossary and context

test("system prompt without glossary returns basic prompt", () => {
  const prompt = buildTranslationSystemPrompt("Vietnamese");
  assert.ok(prompt.includes("Vietnamese"));
  assert.ok(prompt.includes("expert literary translator"));
  assert.ok(!prompt.includes("Glossary"));
});

test("system prompt with glossary includes confirmed and pending entries", () => {
  const glossary: GlossaryPromptEntry[] = [
    {
      canonical: "Trương Tam",
      type: "character",
      status: "confirmed",
      variants: ["Truong Tam", "Trương Ba"],
    },
    {
      canonical: "Cửu Âm Chân Kinh",
      type: "technique",
      status: "pending",
      variants: ["Cửu Âm"],
    },
  ];

  const prompt = buildTranslationSystemPrompt("Vietnamese", glossary);
  assert.ok(prompt.includes("Glossary"));
  assert.ok(prompt.includes("Authoritative"));
  assert.ok(prompt.includes("Trương Tam"));
  assert.ok(prompt.includes("Truong Tam"));
  assert.ok(prompt.includes("Suggested"));
  assert.ok(prompt.includes("Cửu Âm Chân Kinh"));
});

test("system prompt with empty glossary omits glossary section", () => {
  const prompt = buildTranslationSystemPrompt("Vietnamese", []);
  assert.ok(!prompt.includes("Glossary"));
});

test("user prompt without context is basic", () => {
  const prompt = buildTranslationUserPrompt({
    targetLanguage: "Vietnamese",
    sourceTitle: "Chapter 1",
    sourceContent: "Hello world",
  });
  assert.ok(prompt.includes("Vietnamese"));
  assert.ok(prompt.includes("Chapter 1"));
  assert.ok(prompt.includes("Hello world"));
  assert.ok(!prompt.includes("Previous chapter context"));
});

test("user prompt with previous context includes chapter data", () => {
  const context: ChapterContext[] = [
    {
      chapterIndex: 1,
      translatedContent: "Translated chapter 1 content here",
      summary: "Chapter 1 summary goes here",
    },
  ];

  const prompt = buildTranslationUserPrompt(
    {
      targetLanguage: "Vietnamese",
      sourceTitle: "Chapter 2",
      sourceContent: "Source content",
    },
    context
  );

  assert.ok(prompt.includes("Previous chapter context"));
  assert.ok(prompt.includes("Chapter 1"));
  assert.ok(prompt.includes("Chapter 1 summary goes here"));
  assert.ok(prompt.includes("Translated chapter 1 content here"));
});

// 9.3 Test extended payload parsing

test("parseTranslationPayload extracts basic fields", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung đã dịch",
  });

  const result = parseTranslationPayload(payload);
  assert.equal(result.translatedTitle, "Chương 1");
  assert.equal(result.translatedContent, "Nội dung đã dịch");
  assert.equal(result.detectedTerms, undefined);
  assert.equal(result.chapterSummary, undefined);
});

test("parseTranslationPayload extracts detectedTerms when present", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    detectedTerms: [
      { canonical: "Trương Tam", type: "character", variants: ["Truong Tam"] },
      { canonical: "Hoa Sơn", type: "place" },
    ],
  });

  const result = parseTranslationPayload(payload);
  assert.ok(result.detectedTerms);
  assert.equal(result.detectedTerms!.length, 2);
  assert.equal(result.detectedTerms![0].canonical, "Trương Tam");
  assert.equal(result.detectedTerms![0].type, "character");
  assert.deepEqual(result.detectedTerms![0].variants, ["Truong Tam"]);
  assert.equal(result.detectedTerms![1].canonical, "Hoa Sơn");
});

test("parseTranslationPayload extracts chapterSummary when present", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    chapterSummary: "Tóm tắt chương 1: Nhân vật chính xuất hiện.",
  });

  const result = parseTranslationPayload(payload);
  assert.equal(result.chapterSummary, "Tóm tắt chương 1: Nhân vật chính xuất hiện.");
});

test("parseTranslationPayload handles empty detectedTerms gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    detectedTerms: [],
  });

  const result = parseTranslationPayload(payload);
  assert.equal(result.detectedTerms, undefined);
});

test("parseTranslationPayload handles invalid detectedTerms items gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    detectedTerms: [null, { canonical: "" }, { canonical: "Valid" }, 42],
  });

  const result = parseTranslationPayload(payload);
  assert.ok(result.detectedTerms);
  assert.equal(result.detectedTerms!.length, 1);
  assert.equal(result.detectedTerms![0].canonical, "Valid");
});

test("parseTranslationPayload handles empty chapterSummary gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    chapterSummary: "   ",
  });

  const result = parseTranslationPayload(payload);
  assert.equal(result.chapterSummary, undefined);
});

test("parseTranslationPayload extracts from embedded JSON", () => {
  const payload = 'Some text before {"translatedTitle":"Chương 1","translatedContent":"Nội dung","chapterSummary":"Summary"} after';

  const result = parseTranslationPayload(payload);
  assert.equal(result.translatedTitle, "Chương 1");
  assert.equal(result.chapterSummary, "Summary");
});
