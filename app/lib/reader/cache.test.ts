import {
  getCachedDocument,
  setCachedDocument,
  invalidateCachedDocument,
  clearDocumentCache,
} from "./cache";
import type { ReaderDocument } from "./types";

function makeDoc(novelId: string, chapterCount: number): ReaderDocument {
  return {
    novelId,
    novelTitle: `Novel ${novelId}`,
    fileType: "txt",
    chapters: Array.from({ length: chapterCount }, (_, i) => ({
      index: i + 1,
      title: `Chapter ${i + 1}`,
      paragraphs: ["paragraph"],
    })),
    chapterCount,
  };
}

describe("ReaderDocument LRU cache", () => {
  beforeEach(() => {
    clearDocumentCache();
  });

  it("returns undefined on cache miss", () => {
    const result = getCachedDocument("nonexistent", new Date("2025-01-01"));
    expect(result).toBe(undefined);
  });

  it("stores and retrieves a document", () => {
    const doc = makeDoc("novel-1", 5);
    const updatedAt = new Date("2025-06-01");

    setCachedDocument("novel-1", updatedAt, doc);
    const cached = getCachedDocument("novel-1", updatedAt);

    expect(cached).toEqual(doc);
  });

  it("returns undefined for stale updatedAt", () => {
    const doc = makeDoc("novel-1", 5);
    const oldDate = new Date("2025-06-01");
    const newDate = new Date("2025-06-02");

    setCachedDocument("novel-1", oldDate, doc);
    const cached = getCachedDocument("novel-1", newDate);

    expect(cached).toBe(undefined);
  });

  it("evicts oldest entry when cache exceeds max size", () => {
    for (let i = 0; i < 10; i++) {
      setCachedDocument(`novel-${i}`, new Date(2025, 0, i + 1), makeDoc(`novel-${i}`, 1));
    }

    expect(getCachedDocument("novel-0", new Date(2025, 0, 1))).not.toBe(undefined);

    setCachedDocument("novel-10", new Date(2025, 0, 11), makeDoc("novel-10", 1));

    expect(getCachedDocument("novel-0", new Date(2025, 0, 1))).toBe(undefined);
    expect(getCachedDocument("novel-10", new Date(2025, 0, 11))).not.toBe(undefined);
    expect(getCachedDocument("novel-1", new Date(2025, 0, 2))).not.toBe(undefined);
  });

  it("invalidates all entries for a given novelId", () => {
    const date1 = new Date("2025-06-01");
    const date2 = new Date("2025-06-02");

    setCachedDocument("novel-1", date1, makeDoc("novel-1", 3));
    setCachedDocument("novel-1", date2, makeDoc("novel-1", 4));
    setCachedDocument("novel-2", date1, makeDoc("novel-2", 2));

    invalidateCachedDocument("novel-1");

    expect(getCachedDocument("novel-1", date1)).toBe(undefined);
    expect(getCachedDocument("novel-1", date2)).toBe(undefined);
    expect(getCachedDocument("novel-2", date1)).not.toBe(undefined);
  });

  it("clearDocumentCache empties the entire cache", () => {
    setCachedDocument("novel-1", new Date("2025-01-01"), makeDoc("novel-1", 1));
    setCachedDocument("novel-2", new Date("2025-01-01"), makeDoc("novel-2", 1));

    clearDocumentCache();

    expect(getCachedDocument("novel-1", new Date("2025-01-01"))).toBe(undefined);
    expect(getCachedDocument("novel-2", new Date("2025-01-01"))).toBe(undefined);
  });
});
