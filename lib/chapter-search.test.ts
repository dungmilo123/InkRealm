import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findMatches,
  nextMatchIndex,
  prevMatchIndex,
  formatMatchPosition,
} from "./chapter-search";

describe("findMatches", () => {
  it("returns empty array for empty query", () => {
    const paragraphs = ["Hello world"];
    assert.deepStrictEqual(findMatches(paragraphs, ""), []);
  });

  it("returns empty array for whitespace-only query", () => {
    const paragraphs = ["Hello world"];
    assert.deepStrictEqual(findMatches(paragraphs, "   "), []);
  });

  it("finds a single match", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "world");
    assert.equal(matches.length, 1);
    assert.deepStrictEqual(matches[0], {
      paragraphIndex: 0,
      startOffset: 6,
      length: 5,
    });
  });

  it("finds multiple matches in one paragraph", () => {
    const paragraphs = ["the cat sat on the mat"];
    const matches = findMatches(paragraphs, "the");
    assert.equal(matches.length, 2);
    assert.equal(matches[0].startOffset, 0);
    assert.equal(matches[1].startOffset, 15);
  });

  it("finds matches across multiple paragraphs", () => {
    const paragraphs = ["first hello", "second hello", "third"];
    const matches = findMatches(paragraphs, "hello");
    assert.equal(matches.length, 2);
    assert.equal(matches[0].paragraphIndex, 0);
    assert.equal(matches[1].paragraphIndex, 1);
  });

  it("is case-insensitive", () => {
    const paragraphs = ["Hello HELLO hElLo"];
    const matches = findMatches(paragraphs, "hello");
    assert.equal(matches.length, 3);
  });

  it("returns no matches when query not found", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "xyz");
    assert.equal(matches.length, 0);
  });

  it("handles overlapping potential matches (non-overlapping)", () => {
    const paragraphs = ["aaa"];
    const matches = findMatches(paragraphs, "aa");
    // "aaa" contains "aa" starting at 0 and at 1 (non-overlapping would be 0 and 2, but we advance by 1)
    assert.equal(matches.length, 2);
    assert.equal(matches[0].startOffset, 0);
    assert.equal(matches[1].startOffset, 1);
  });

  it("trims query before searching", () => {
    const paragraphs = ["Hello world"];
    const matches = findMatches(paragraphs, "  world  ");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].startOffset, 6);
    assert.equal(matches[0].length, 5);
  });

  it("handles empty paragraphs array", () => {
    const matches = findMatches([], "hello");
    assert.equal(matches.length, 0);
  });

  it("handles empty paragraph strings", () => {
    const paragraphs = ["", "hello", ""];
    const matches = findMatches(paragraphs, "hello");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].paragraphIndex, 1);
  });

  it("matches at start and end of paragraph", () => {
    const paragraphs = ["hello world hello"];
    const matches = findMatches(paragraphs, "hello");
    assert.equal(matches.length, 2);
    assert.equal(matches[0].startOffset, 0);
    assert.equal(matches[1].startOffset, 12);
  });

  it("handles special regex characters in query", () => {
    // findMatches uses indexOf, not regex, so special chars are literal
    const paragraphs = ["price is $5.00"];
    const matches = findMatches(paragraphs, "$5.00");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].startOffset, 9);
  });
});

describe("nextMatchIndex", () => {
  it("returns -1 for zero matches", () => {
    assert.equal(nextMatchIndex(0, 0), -1);
  });

  it("advances to next index", () => {
    assert.equal(nextMatchIndex(0, 5), 1);
    assert.equal(nextMatchIndex(3, 5), 4);
  });

  it("wraps around from last to first", () => {
    assert.equal(nextMatchIndex(4, 5), 0);
  });
});

describe("prevMatchIndex", () => {
  it("returns -1 for zero matches", () => {
    assert.equal(prevMatchIndex(0, 0), -1);
  });

  it("goes to previous index", () => {
    assert.equal(prevMatchIndex(3, 5), 2);
    assert.equal(prevMatchIndex(1, 5), 0);
  });

  it("wraps around from first to last", () => {
    assert.equal(prevMatchIndex(0, 5), 4);
  });
});

describe("formatMatchPosition", () => {
  it("returns empty string for zero matches", () => {
    assert.equal(formatMatchPosition(0, 0), "");
  });

  it("formats 1-based position", () => {
    assert.equal(formatMatchPosition(0, 10), "1 of 10");
    assert.equal(formatMatchPosition(9, 10), "10 of 10");
  });

  it("formats single match", () => {
    assert.equal(formatMatchPosition(0, 1), "1 of 1");
  });
});
