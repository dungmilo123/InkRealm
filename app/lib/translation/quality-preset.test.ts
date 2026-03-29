import assert from "node:assert/strict";
import test from "node:test";
import { resolveQualityPreset } from "@/app/lib/translation/quality-presets";

// 9.5 Test quality preset resolution

test("resolveQualityPreset returns fast defaults for undefined", () => {
  const result = resolveQualityPreset(undefined);
  assert.equal(result.contextChapters, 0);
  assert.equal(result.contextSummaries, 0);
  assert.equal(result.useGlossary, false);
});

test("resolveQualityPreset returns fast defaults for unknown string", () => {
  const result = resolveQualityPreset("unknown");
  assert.equal(result.contextChapters, 0);
  assert.equal(result.contextSummaries, 0);
  assert.equal(result.useGlossary, false);
});

test("resolveQualityPreset returns standard values", () => {
  const result = resolveQualityPreset("standard");
  assert.equal(result.contextChapters, 1);
  assert.equal(result.contextSummaries, 3);
  assert.equal(result.useGlossary, true);
});

test("resolveQualityPreset returns premium values", () => {
  const result = resolveQualityPreset("premium");
  assert.equal(result.contextChapters, 3);
  assert.equal(result.contextSummaries, 5);
  assert.equal(result.useGlossary, true);
});

test("resolveQualityPreset returns fast values explicitly", () => {
  const result = resolveQualityPreset("fast");
  assert.equal(result.contextChapters, 0);
  assert.equal(result.contextSummaries, 0);
  assert.equal(result.useGlossary, false);
});
