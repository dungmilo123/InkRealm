/**
 * Unit tests for the client-side chapter-status merge logic.
 *
 * The merge algorithm lives inside a `useMemo` in DetailsTabs but the
 * underlying logic is a pure transformation. We replicate it here as a
 * standalone function so tests don't depend on React rendering machinery.
 *
 * Algorithm (from details-tabs.tsx):
 *   if polled is empty  → return initial unchanged
 *   else                → start with initial entries in a Map,
 *                          overlay polled entries (polled wins on collision),
 *                          return sorted by chapterIndex ascending
 */

// ── Pure merge function extracted from the useMemo in DetailsTabs ────────────

type ChapterStatusItem = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  completedAt?: string;
  summary?: string | null;
};

function mergeChapterStatuses(
  initialChapterStatuses: ChapterStatusItem[],
  polledChapterStatuses: ChapterStatusItem[]
): ChapterStatusItem[] {
  if (polledChapterStatuses.length === 0) return initialChapterStatuses;
  const merged = new Map(
    initialChapterStatuses.map((s) => [s.chapterIndex, s])
  );
  for (const s of polledChapterStatuses) {
    merged.set(s.chapterIndex, s);
  }
  return Array.from(merged.values()).sort((a, b) => a.chapterIndex - b.chapterIndex);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInitial(indices: number[]): ChapterStatusItem[] {
  return indices.map((i) => ({ chapterIndex: i, status: "translated" as const }));
}

function makePolled(
  entries: Array<{ i: number; status: ChapterStatusItem["status"] }>
): ChapterStatusItem[] {
  return entries.map(({ i, status }) => ({ chapterIndex: i, status }));
}

// ── Test cases ────────────────────────────────────────────────────────────────

test("polled statuses overlay initial without losing prior chapters", () => {
  const initial = makeInitial([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const polled = makePolled([
    { i: 6, status: "translating" },
    { i: 7, status: "translating" },
    { i: 8, status: "untranslated" },
    { i: 9, status: "untranslated" },
    { i: 10, status: "untranslated" },
  ]);

  const merged = mergeChapterStatuses(initial, polled);

  // All 10 chapters must be present
  expect(merged.length).toBe(10, "should have 10 chapters");

  // Chapters 1-5 retain translated status from initial
  for (let i = 1; i <= 5; i++) {
    const entry = merged.find((s) => s.chapterIndex === i);
    expect(entry, `chapter ${i} must exist`).toBeTruthy();
    expect(entry!.status).toBe("translated", `chapter ${i} should be translated`);
  }

  // Chapters 6-10 use polled status
  expect(merged.find((s) => s.chapterIndex === 6)?.status).toBe("translating");
  expect(merged.find((s) => s.chapterIndex === 7)?.status).toBe("translating");
  expect(merged.find((s) => s.chapterIndex === 8)?.status).toBe("untranslated");
  expect(merged.find((s) => s.chapterIndex === 9)?.status).toBe("untranslated");
  expect(merged.find((s) => s.chapterIndex === 10)?.status).toBe("untranslated");
});

test("empty polled returns initialChapterStatuses unchanged", () => {
  const initial = makeInitial([1, 2, 3]);
  const merged = mergeChapterStatuses(initial, []);

  // Must be the exact same reference (no copy performed)
  expect(merged).toBe(initial, "should return the exact initial reference");
});

test("result is sorted by chapterIndex ascending when input order is jumbled", () => {
  const initial: ChapterStatusItem[] = [
    { chapterIndex: 5, status: "translated" },
    { chapterIndex: 1, status: "translated" },
    { chapterIndex: 3, status: "translated" },
  ];
  const polled: ChapterStatusItem[] = [
    { chapterIndex: 4, status: "translating" },
    { chapterIndex: 2, status: "untranslated" },
  ];

  const merged = mergeChapterStatuses(initial, polled);

  const indices = merged.map((s) => s.chapterIndex);
  expect(indices).toEqual([1, 2, 3, 4, 5], "should be sorted ascending");
});

test("polled entry overwrites initial entry for the same chapter", () => {
  const initial: ChapterStatusItem[] = [{ chapterIndex: 1, status: "translated" }];
  const polled: ChapterStatusItem[] = [{ chapterIndex: 1, status: "translating" }];

  const merged = mergeChapterStatuses(initial, polled);

  expect(merged.length).toBe(1);
  expect(merged[0].status).toBe("translating", "polled should win for chapter 1");
});
