import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  countWords,
  countWordsInParagraphs,
  estimateReadingMinutes,
  formatReadingTime,
  formatWordCount,
} from "./reading-time";

describe("countWords", () => {
  test("counts words in a normal sentence", () => {
    assert.equal(countWords("Hello world foo bar"), 4);
  });

  test("returns 0 for empty string", () => {
    assert.equal(countWords(""), 0);
  });

  test("returns 0 for whitespace-only string", () => {
    assert.equal(countWords("   \t  \n  "), 0);
  });

  test("handles single word", () => {
    assert.equal(countWords("hello"), 1);
  });

  test("handles multiple spaces between words", () => {
    assert.equal(countWords("hello    world"), 2);
  });

  test("handles leading and trailing whitespace", () => {
    assert.equal(countWords("  hello world  "), 2);
  });

  test("handles tabs and newlines", () => {
    assert.equal(countWords("hello\tworld\nfoo"), 3);
  });
});

describe("countWordsInParagraphs", () => {
  test("sums words across paragraphs", () => {
    assert.equal(
      countWordsInParagraphs(["Hello world", "Foo bar baz"]),
      5
    );
  });

  test("returns 0 for empty array", () => {
    assert.equal(countWordsInParagraphs([]), 0);
  });

  test("skips empty paragraphs", () => {
    assert.equal(
      countWordsInParagraphs(["Hello world", "", "  ", "Foo"]),
      3
    );
  });
});

describe("estimateReadingMinutes", () => {
  test("returns 0 for 0 words", () => {
    assert.equal(estimateReadingMinutes(0), 0);
  });

  test("returns 0 for negative word count", () => {
    assert.equal(estimateReadingMinutes(-100), 0);
  });

  test("returns minimum 1 minute for small word counts", () => {
    assert.equal(estimateReadingMinutes(1), 1);
    assert.equal(estimateReadingMinutes(50), 1);
    assert.equal(estimateReadingMinutes(238), 1);
  });

  test("rounds up to next minute", () => {
    // 239 words / 238 WPM = 1.004 → ceil = 2
    assert.equal(estimateReadingMinutes(239), 2);
  });

  test("calculates correctly for larger counts", () => {
    // 238 * 10 = 2380 words → 10 minutes exactly
    assert.equal(estimateReadingMinutes(2380), 10);
    // 238 * 60 = 14280 words → 60 minutes
    assert.equal(estimateReadingMinutes(14280), 60);
  });
});

describe("formatReadingTime", () => {
  test("formats zero as less than 1 min", () => {
    assert.equal(formatReadingTime(0), "< 1 min");
  });

  test("formats minutes under 60", () => {
    assert.equal(formatReadingTime(1), "1 min");
    assert.equal(formatReadingTime(45), "45 min");
  });

  test("formats exact hours", () => {
    assert.equal(formatReadingTime(60), "1 hr");
    assert.equal(formatReadingTime(120), "2 hr");
  });

  test("formats hours with remaining minutes", () => {
    assert.equal(formatReadingTime(90), "1 hr 30 min");
    assert.equal(formatReadingTime(150), "2 hr 30 min");
    assert.equal(formatReadingTime(61), "1 hr 1 min");
  });
});

describe("formatWordCount", () => {
  test("formats counts under 1000 as-is", () => {
    assert.equal(formatWordCount(0), "0");
    assert.equal(formatWordCount(500), "500");
    assert.equal(formatWordCount(999), "999");
  });

  test("formats counts in the thousands with one decimal", () => {
    assert.equal(formatWordCount(1000), "1.0k");
    assert.equal(formatWordCount(1234), "1.2k");
    assert.equal(formatWordCount(9999), "10.0k");
  });

  test("formats tens of thousands", () => {
    assert.equal(formatWordCount(15678), "15.7k");
    assert.equal(formatWordCount(50000), "50.0k");
  });

  test("formats hundreds of thousands as rounded k", () => {
    assert.equal(formatWordCount(123456), "123k");
    assert.equal(formatWordCount(500000), "500k");
  });
});
