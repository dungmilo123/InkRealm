import {
  findMatches,
  nextMatchIndex,
  prevMatchIndex,
  formatMatchPosition,
} from "./chapter-search";

describe("findMatches", () => {
  it("returns empty array for empty query", () => {
    const paragraphs = ["Hello world"];
    expect(findMatches(paragraphs, "")).toEqual([]);
  });

  it("returns empty array for whitespace-only query", () => {
    const paragraphs = ["Hello world"];
    expect(findMatches(paragraphs, "   ")).toEqual([]);
  });

  it("finds a single match", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "world");
    expect(matches.length).toBe(1);
    expect(matches[0]).toEqual({
      paragraphIndex: 0,
      startOffset: 6,
      length: 5,
    });
  });

  it("finds multiple matches in one paragraph", () => {
    const paragraphs = ["the cat sat on the mat"];
    const matches = findMatches(paragraphs, "the");
    expect(matches.length).toBe(2);
    expect(matches[0].startOffset).toBe(0);
    expect(matches[1].startOffset).toBe(15);
  });

  it("finds matches across multiple paragraphs", () => {
    const paragraphs = ["first hello", "second hello", "third"];
    const matches = findMatches(paragraphs, "hello");
    expect(matches.length).toBe(2);
    expect(matches[0].paragraphIndex).toBe(0);
    expect(matches[1].paragraphIndex).toBe(1);
  });

  it("is case-insensitive", () => {
    const paragraphs = ["Hello HELLO hElLo"];
    const matches = findMatches(paragraphs, "hello");
    expect(matches.length).toBe(3);
  });

  it("returns no matches when query not found", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "xyz");
    expect(matches.length).toBe(0);
  });

  it("handles overlapping potential matches (non-overlapping)", () => {
    const paragraphs = ["aaa"];
    const matches = findMatches(paragraphs, "aa");
    // "aaa" contains "aa" starting at 0 and at 1 (non-overlapping would be 0 and 2, but we advance by 1)
    expect(matches.length).toBe(2);
    expect(matches[0].startOffset).toBe(0);
    expect(matches[1].startOffset).toBe(1);
  });

  it("trims query before searching", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "  world  ");
    expect(matches.length).toBe(1);
    expect(matches[0].startOffset).toBe(6);
    expect(matches[0].length).toBe(5);
  });

  it("handles empty paragraphs array", () => {
    const matches = findMatches([], "hello");
    expect(matches.length).toBe(0);
  });

  it("handles empty paragraph strings", () => {
    const paragraphs = ["", "hello", ""];
    const matches = findMatches(paragraphs, "hello");
    expect(matches.length).toBe(1);
    expect(matches[0].paragraphIndex).toBe(1);
  });

  it("matches at start and end of paragraph", () => {
    const paragraphs = ["hello world hello"];
    const matches = findMatches(paragraphs, "hello");
    expect(matches.length).toBe(2);
    expect(matches[0].startOffset).toBe(0);
    expect(matches[1].startOffset).toBe(12);
  });

  it("handles special regex characters in query", () => {
    // findMatches uses indexOf, not regex, so special chars are literal
    const paragraphs = ["price is $5.00"];
    const matches = findMatches(paragraphs, "$5.00");
    expect(matches.length).toBe(1);
    expect(matches[0].startOffset).toBe(9);
  });
});

describe("nextMatchIndex", () => {
  it("returns -1 for zero matches", () => {
    expect(nextMatchIndex(0, 0)).toBe(-1);
  });

  it("advances to next index", () => {
    expect(nextMatchIndex(0, 5)).toBe(1);
    expect(nextMatchIndex(3, 5)).toBe(4);
  });

  it("wraps around from last to first", () => {
    expect(nextMatchIndex(4, 5)).toBe(0);
  });
});

describe("prevMatchIndex", () => {
  it("returns -1 for zero matches", () => {
    expect(prevMatchIndex(0, 0)).toBe(-1);
  });

  it("goes to previous index", () => {
    expect(prevMatchIndex(3, 5)).toBe(2);
    expect(prevMatchIndex(1, 5)).toBe(0);
  });

  it("wraps around from first to last", () => {
    expect(prevMatchIndex(0, 5)).toBe(4);
  });
});

describe("formatMatchPosition", () => {
  it("returns empty string for zero matches", () => {
    expect(formatMatchPosition(0, 0)).toBe("");
  });

  it("formats 1-based position", () => {
    expect(formatMatchPosition(0, 10)).toBe("1 of 10");
    expect(formatMatchPosition(9, 10)).toBe("10 of 10");
  });

  it("formats single match", () => {
    expect(formatMatchPosition(0, 1)).toBe("1 of 1");
  });
});
