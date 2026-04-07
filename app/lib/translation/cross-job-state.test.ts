/**
 * Unit tests for server-side cross-job chapter state resolution.
 *
 * The core merge logic from `getInitialChapterStatuses` is extracted here as
 * a pure function so it can be tested without mocking DB accessors.
 * The function faithfully replicates the merge algorithm in service.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";

// ── Types (mirrors ChapterStatusItem from service.ts) ─────────────────────────

type ChapterStatusItem = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  summary?: string | null;
};

type TranslatedRow = { chapterIndex: number; summary: string | null };
type JobStatusRow = { chapterIndex: number; status: "TRANSLATED" | "TRANSLATING" | "PENDING" | "FAILED"; summary: string | null };

// ── Pure merge function (replicated from service.ts getInitialChapterStatuses) ─

function mapChapterStatus(prismaStatus: string): "translated" | "translating" | "untranslated" {
  switch (prismaStatus) {
    case "TRANSLATED": return "translated";
    case "TRANSLATING": return "translating";
    case "PENDING":
    case "FAILED":
    default: return "untranslated";
  }
}

/**
 * Pure merge logic extracted from getInitialChapterStatuses.
 * Combines translated chapters (from the per-novel source-of-truth table)
 * with latest job statuses (which may include in-progress/pending chapters).
 */
function mergeChapterStatuses(
  translatedRows: TranslatedRow[],
  latestJobStatuses: JobStatusRow[] | null
): ChapterStatusItem[] {
  const translatedMap = new Map<number, { status: "translated" | "translating" | "untranslated"; summary: string | null }>(
    translatedRows.map((row) => [
      row.chapterIndex,
      { status: "translated" as const, summary: row.summary },
    ])
  );

  if (latestJobStatuses) {
    for (const ch of latestJobStatuses) {
      const mapped = mapChapterStatus(ch.status);
      // This is the exact condition from service.ts (after T01 fix):
      // "translated" or "translating" always overrides, and new chapters
      // (!translatedMap.has) are added.
      if (mapped === "translated" || mapped === "translating" || !translatedMap.has(ch.chapterIndex)) {
        translatedMap.set(ch.chapterIndex, {
          status: mapped,
          summary: ch.summary ?? null,
        });
      }
    }
  }

  return Array.from(translatedMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([chapterIndex, { status, summary }]) => ({
      chapterIndex,
      status,
      ...(summary ? { summary } : {}),
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTranslatedRows(indices: number[]): TranslatedRow[] {
  return indices.map((i) => ({ chapterIndex: i, summary: null }));
}

function makeJobStatuses(
  entries: Array<{ chapterIndex: number; status: JobStatusRow["status"] }>
): JobStatusRow[] {
  return entries.map((e) => ({
    chapterIndex: e.chapterIndex,
    status: e.status,
    summary: null,
  }));
}

// ── Test cases ────────────────────────────────────────────────────────────────

test("retranslating chapter shows 'translating' not 'translated'", () => {
  // Chapters 1-5 translated in a prior job
  const translated = makeTranslatedRows([1, 2, 3, 4, 5]);
  // Active job retranslating chapter 3
  const jobStatuses = makeJobStatuses([{ chapterIndex: 3, status: "TRANSLATING" }]);

  const result = mergeChapterStatuses(translated, jobStatuses);
  const byIndex = new Map(result.map((s) => [s.chapterIndex, s.status]));

  assert.equal(byIndex.get(3), "translating", "chapter 3 should be translating during rerun");
  assert.equal(byIndex.get(1), "translated");
  assert.equal(byIndex.get(2), "translated");
  assert.equal(byIndex.get(4), "translated");
  assert.equal(byIndex.get(5), "translated");
});

test("new job chapters don't reset prior translations", () => {
  // Chapters 1-5 translated in prior job
  const translated = makeTranslatedRows([1, 2, 3, 4, 5]);
  // Active job covers chapters 6-10 (all PENDING)
  const jobStatuses = makeJobStatuses([
    { chapterIndex: 6, status: "PENDING" },
    { chapterIndex: 7, status: "PENDING" },
    { chapterIndex: 8, status: "PENDING" },
    { chapterIndex: 9, status: "PENDING" },
    { chapterIndex: 10, status: "PENDING" },
  ]);

  const result = mergeChapterStatuses(translated, jobStatuses);
  const byIndex = new Map(result.map((s) => [s.chapterIndex, s.status]));

  // Prior chapters stay translated
  for (const i of [1, 2, 3, 4, 5]) {
    assert.equal(byIndex.get(i), "translated", `chapter ${i} should remain translated`);
  }
  // New PENDING chapters show as untranslated
  for (const i of [6, 7, 8, 9, 10]) {
    assert.equal(byIndex.get(i), "untranslated", `chapter ${i} should be untranslated`);
  }
  assert.equal(result.length, 10, "all 10 chapters present");
});

test("no active job returns only translated chapters", () => {
  const translated = makeTranslatedRows([1, 2, 3, 4, 5]);

  const result = mergeChapterStatuses(translated, null);

  assert.equal(result.length, 5);
  assert.ok(result.every((s) => s.status === "translated"), "all should be translated");
});

test("active job completed chapter overrides prior translation entry", () => {
  // Chapter 3 translated in prior job
  const translated = makeTranslatedRows([3]);
  // Active job also completed chapter 3 (new translation)
  const jobStatuses = makeJobStatuses([{ chapterIndex: 3, status: "TRANSLATED" }]);

  const result = mergeChapterStatuses(translated, jobStatuses);

  assert.equal(result.length, 1);
  assert.equal(result[0].chapterIndex, 3);
  assert.equal(result[0].status, "translated");
});

test("FAILED chapter in latest job does not override prior translated chapter", () => {
  // Chapter 2 translated in prior job
  const translated = makeTranslatedRows([2]);
  // Active job tried to retranslate chapter 2 but FAILED
  const jobStatuses = makeJobStatuses([{ chapterIndex: 2, status: "FAILED" }]);

  const result = mergeChapterStatuses(translated, jobStatuses);

  // FAILED maps to "untranslated" which should NOT override existing "translated"
  // because the condition only allows "translated", "translating", or new chapters
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "translated", "FAILED should not overwrite prior translated");
});

test("result is sorted by chapterIndex ascending", () => {
  const translated: TranslatedRow[] = [
    { chapterIndex: 5, summary: null },
    { chapterIndex: 1, summary: null },
  ];
  const jobStatuses = makeJobStatuses([
    { chapterIndex: 3, status: "TRANSLATING" },
    { chapterIndex: 2, status: "PENDING" },
  ]);

  const result = mergeChapterStatuses(translated, jobStatuses);
  const indices = result.map((s) => s.chapterIndex);

  assert.deepEqual(indices, [1, 2, 3, 5], "sorted ascending");
});

test("summary is preserved from translated rows and latest job", () => {
  const translated: TranslatedRow[] = [
    { chapterIndex: 1, summary: "A great start" },
    { chapterIndex: 2, summary: null },
  ];
  const jobStatuses: JobStatusRow[] = [
    { chapterIndex: 2, status: "TRANSLATED", summary: "New summary from rerun" },
  ];

  const result = mergeChapterStatuses(translated, jobStatuses);

  assert.equal(result.find((s) => s.chapterIndex === 1)?.summary, "A great start");
  assert.equal(result.find((s) => s.chapterIndex === 2)?.summary, "New summary from rerun");
});
