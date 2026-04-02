import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateTranslationEta, formatEtaLabel } from "./translation-eta";

describe("calculateTranslationEta", () => {
  it("returns nulls when jobCreatedAt is undefined", () => {
    const result = calculateTranslationEta([], 10, undefined);
    assert.equal(result.etaMs, null);
    assert.equal(result.etaLabel, null);
    assert.equal(result.avgChapterMs, null);
  });

  it("returns nulls when totalChapters is 0", () => {
    const result = calculateTranslationEta([], 0, "2026-01-01T00:00:00Z");
    assert.equal(result.etaMs, null);
  });

  it("returns nulls when no chapters are translated", () => {
    const statuses = [
      { status: "untranslated" as const },
      { status: "translating" as const },
    ];
    const result = calculateTranslationEta(statuses, 5, "2026-01-01T00:00:00Z");
    assert.equal(result.etaMs, null);
  });

  it("returns nulls when translated chapters have no completedAt", () => {
    const statuses = [{ status: "translated" as const }];
    const result = calculateTranslationEta(statuses, 5, "2026-01-01T00:00:00Z");
    assert.equal(result.etaMs, null);
  });

  it("computes ETA from a single completed chapter", () => {
    const jobStart = "2026-01-01T00:00:00Z";
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" }, // 60s after start
      { status: "untranslated" as const },
      { status: "untranslated" as const },
    ];
    const result = calculateTranslationEta(statuses, 3, jobStart);
    // 1 chapter took 60s, 2 remaining → 120s = 120000ms
    assert.equal(result.etaMs, 120000);
    assert.equal(result.etaLabel, "~2 min");
    assert.equal(result.avgChapterMs, 60000);
  });

  it("uses EMA weighting for multiple chapters (recent chapters weighted more)", () => {
    const jobStart = "2026-01-01T00:00:00Z";
    // Ch1: 60s, Ch2: 120s (slower), Ch3: 30s (faster)
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" },  // +60s
      { status: "translated" as const, completedAt: "2026-01-01T00:03:00Z" },  // +120s
      { status: "translated" as const, completedAt: "2026-01-01T00:03:30Z" },  // +30s
      { status: "untranslated" as const },
      { status: "untranslated" as const },
    ];
    const result = calculateTranslationEta(statuses, 5, jobStart);

    // EMA: start=60000, then 0.3*120000 + 0.7*60000 = 78000, then 0.3*30000 + 0.7*78000 = 63600
    // remaining = 2 chapters → 63600 * 2 = 127200
    assert.equal(result.etaMs, 127200);
    assert.equal(result.avgChapterMs, 63600);
  });

  it("returns etaMs=0 when all chapters are translated", () => {
    const jobStart = "2026-01-01T00:00:00Z";
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" },
      { status: "translated" as const, completedAt: "2026-01-01T00:02:00Z" },
    ];
    const result = calculateTranslationEta(statuses, 2, jobStart);
    assert.equal(result.etaMs, 0);
    assert.equal(result.etaLabel, null);
    assert.notEqual(result.avgChapterMs, null);
  });

  it("skips zero/negative durations (clock skew or retry artifacts)", () => {
    const jobStart = "2026-01-01T00:02:00Z"; // Start AFTER first chapter timestamp
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" }, // Before job start → negative
      { status: "translated" as const, completedAt: "2026-01-01T00:03:00Z" }, // 2min after prev
      { status: "untranslated" as const },
    ];
    const result = calculateTranslationEta(statuses, 3, jobStart);
    // Only the second duration is valid (from ch1 to ch2 = 120s)
    assert.equal(result.avgChapterMs, 120000);
  });

  it("sorts chapters by completedAt regardless of input order", () => {
    const jobStart = "2026-01-01T00:00:00Z";
    // Chapters arrive in reverse order
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:02:00Z" }, // ch2
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" }, // ch1
      { status: "untranslated" as const },
    ];
    const result = calculateTranslationEta(statuses, 3, jobStart);
    // Sorted: ch1 at +60s, ch2 at +60s after ch1 → durations [60s, 60s]
    // EMA: 60000, then 0.3*60000+0.7*60000 = 60000
    assert.equal(result.avgChapterMs, 60000);
    assert.equal(result.etaMs, 60000); // 1 remaining
  });

  it("handles all nonsensical durations gracefully", () => {
    const jobStart = "2026-01-01T00:05:00Z"; // After all chapters
    const statuses = [
      { status: "translated" as const, completedAt: "2026-01-01T00:01:00Z" },
      { status: "translated" as const, completedAt: "2026-01-01T00:02:00Z" },
      { status: "untranslated" as const },
    ];
    const result = calculateTranslationEta(statuses, 3, jobStart);
    // First duration: ch1 - jobStart = negative → skipped
    // Second duration: ch2 - ch1 = 60s → kept
    assert.equal(result.avgChapterMs, 60000);
  });
});

describe("formatEtaLabel", () => {
  it("formats seconds (< 1 min)", () => {
    assert.equal(formatEtaLabel(30_000), "~30 sec");
  });

  it("enforces minimum 5 seconds", () => {
    assert.equal(formatEtaLabel(1_000), "~5 sec");
    assert.equal(formatEtaLabel(0), "~5 sec");
  });

  it("formats minutes (< 1 hour)", () => {
    assert.equal(formatEtaLabel(300_000), "~5 min");
  });

  it("formats exact hours", () => {
    assert.equal(formatEtaLabel(3_600_000), "~1 hr");
  });

  it("formats hours and minutes", () => {
    assert.equal(formatEtaLabel(4_500_000), "~1 hr 15 min");
  });

  it("formats multi-hour durations", () => {
    assert.equal(formatEtaLabel(7_200_000), "~2 hr");
    assert.equal(formatEtaLabel(9_000_000), "~2 hr 30 min");
  });

  it("rounds to nearest minute for sub-minute values near boundary", () => {
    // 59.5 seconds → rounds to 60 seconds → 1 min
    assert.equal(formatEtaLabel(59_500), "~1 min");
  });
});
