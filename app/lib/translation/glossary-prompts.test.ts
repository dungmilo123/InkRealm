import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  parseTranslationPayload,
} from "@/app/lib/translation/adapters/shared";
import type { GlossaryPromptEntry, ChapterContext } from "@/app/lib/translation/adapters/types";

// 9.2 Test prompt construction with glossary and context

test("system prompt without glossary returns basic prompt", () => {
  const prompt = buildTranslationSystemPrompt("Vietnamese");
  expect(prompt).toContain("Vietnamese");
  expect(prompt).toContain("expert literary editor");
  expect(prompt).not.toContain("Glossary");
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
  expect(prompt).toContain("Glossary");
  expect(prompt).toContain("Authoritative");
  expect(prompt).toContain("Trương Tam");
  expect(prompt).toContain("Truong Tam");
  expect(prompt).toContain("Suggested");
  expect(prompt).toContain("Cửu Âm Chân Kinh");
});

test("system prompt with empty glossary omits glossary section", () => {
  const prompt = buildTranslationSystemPrompt("Vietnamese", []);
  expect(prompt).not.toContain("Glossary");
});

test("user prompt without context is basic", () => {
  const prompt = buildTranslationUserPrompt({
    targetLanguage: "Vietnamese",
    sourceTitle: "Chapter 1",
    sourceContent: "Hello world",
  });
  expect(prompt).toContain("Vietnamese");
  expect(prompt).toContain("Chapter 1");
  expect(prompt).toContain("Hello world");
  expect(prompt).not.toContain("Previous chapter context");
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

  expect(prompt).toContain("Previous chapter context");
  expect(prompt).toContain("Chapter 1");
  expect(prompt).toContain("Chapter 1 summary goes here");
  expect(prompt).toContain("Translated chapter 1 content here");
});

// 9.3 Test extended payload parsing

test("parseTranslationPayload extracts basic fields", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung đã dịch",
  });

  const result = parseTranslationPayload(payload);
  expect(result.translatedTitle).toBe("Chương 1");
  expect(result.translatedContent).toBe("Nội dung đã dịch");
  expect(result.detectedTerms).toBe(undefined);
  expect(result.chapterSummary).toBe(undefined);
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
  expect(result.detectedTerms).toBeTruthy();
  expect(result.detectedTerms!.length).toBe(2);
  expect(result.detectedTerms![0].canonical).toBe("Trương Tam");
  expect(result.detectedTerms![0].type).toBe("character");
  expect(result.detectedTerms![0].variants).toEqual(["Truong Tam"]);
  expect(result.detectedTerms![1].canonical).toBe("Hoa Sơn");
});

test("parseTranslationPayload extracts chapterSummary when present", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    chapterSummary: "Tóm tắt chương 1: Nhân vật chính xuất hiện.",
  });

  const result = parseTranslationPayload(payload);
  expect(result.chapterSummary).toBe("Tóm tắt chương 1: Nhân vật chính xuất hiện.");
});

test("parseTranslationPayload handles empty detectedTerms gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    detectedTerms: [],
  });

  const result = parseTranslationPayload(payload);
  expect(result.detectedTerms).toBe(undefined);
});

test("parseTranslationPayload handles invalid detectedTerms items gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    detectedTerms: [null, { canonical: "" }, { canonical: "Valid" }, 42],
  });

  const result = parseTranslationPayload(payload);
  expect(result.detectedTerms).toBeTruthy();
  expect(result.detectedTerms!.length).toBe(1);
  expect(result.detectedTerms![0].canonical).toBe("Valid");
});

test("parseTranslationPayload handles empty chapterSummary gracefully", () => {
  const payload = JSON.stringify({
    translatedTitle: "Chương 1",
    translatedContent: "Nội dung",
    chapterSummary: "   ",
  });

  const result = parseTranslationPayload(payload);
  expect(result.chapterSummary).toBe(undefined);
});

test("parseTranslationPayload extracts from embedded JSON", () => {
  const payload = 'Some text before {"translatedTitle":"Chương 1","translatedContent":"Nội dung","chapterSummary":"Summary"} after';

  const result = parseTranslationPayload(payload);
  expect(result.translatedTitle).toBe("Chương 1");
  expect(result.chapterSummary).toBe("Summary");
});
