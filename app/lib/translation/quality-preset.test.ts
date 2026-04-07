import { resolveQualityPreset } from "@/app/lib/translation/quality-presets";

// 9.5 Test quality preset resolution

test("resolveQualityPreset returns fast defaults for undefined", () => {
  const result = resolveQualityPreset(undefined);
  expect(result.contextChapters).toBe(0);
  expect(result.contextSummaries).toBe(0);
  expect(result.useGlossary).toBe(false);
});

test("resolveQualityPreset returns fast defaults for unknown string", () => {
  const result = resolveQualityPreset("unknown");
  expect(result.contextChapters).toBe(0);
  expect(result.contextSummaries).toBe(0);
  expect(result.useGlossary).toBe(false);
});

test("resolveQualityPreset returns standard values", () => {
  const result = resolveQualityPreset("standard");
  expect(result.contextChapters).toBe(1);
  expect(result.contextSummaries).toBe(3);
  expect(result.useGlossary).toBe(true);
});

test("resolveQualityPreset returns premium values", () => {
  const result = resolveQualityPreset("premium");
  expect(result.contextChapters).toBe(3);
  expect(result.contextSummaries).toBe(5);
  expect(result.useGlossary).toBe(true);
});

test("resolveQualityPreset returns fast values explicitly", () => {
  const result = resolveQualityPreset("fast");
  expect(result.contextChapters).toBe(0);
  expect(result.contextSummaries).toBe(0);
  expect(result.useGlossary).toBe(false);
});
