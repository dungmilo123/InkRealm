import {
  countWords,
  countWordsInParagraphs,
  estimateReadingMinutes,
  formatReadingTime,
  formatWordCount,
} from "./reading-time";

describe("countWords", () => {
  test("counts words in a normal sentence", () => {
    expect(countWords("Hello world foo bar")).toBe(4);
  });

  test("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  test("returns 0 for whitespace-only string", () => {
    expect(countWords("   \t  \n  ")).toBe(0);
  });

  test("handles single word", () => {
    expect(countWords("hello")).toBe(1);
  });

  test("handles multiple spaces between words", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  test("handles leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  test("handles tabs and newlines", () => {
    expect(countWords("hello\tworld\nfoo")).toBe(3);
  });
});

describe("countWordsInParagraphs", () => {
  test("sums words across paragraphs", () => {
    expect(countWordsInParagraphs(["Hello world", "Foo bar baz"])).toBe(5);
  });

  test("returns 0 for empty array", () => {
    expect(countWordsInParagraphs([])).toBe(0);
  });

  test("skips empty paragraphs", () => {
    expect(countWordsInParagraphs(["Hello world", "", "  ", "Foo"])).toBe(3);
  });
});

describe("estimateReadingMinutes", () => {
  test("returns 0 for 0 words", () => {
    expect(estimateReadingMinutes(0)).toBe(0);
  });

  test("returns 0 for negative word count", () => {
    expect(estimateReadingMinutes(-100)).toBe(0);
  });

  test("returns minimum 1 minute for small word counts", () => {
    expect(estimateReadingMinutes(1)).toBe(1);
    expect(estimateReadingMinutes(50)).toBe(1);
    expect(estimateReadingMinutes(238)).toBe(1);
  });

  test("rounds up to next minute", () => {
    // 239 words / 238 WPM = 1.004 → ceil = 2
    expect(estimateReadingMinutes(239)).toBe(2);
  });

  test("calculates correctly for larger counts", () => {
    // 238 * 10 = 2380 words → 10 minutes exactly
    expect(estimateReadingMinutes(2380)).toBe(10);
    // 238 * 60 = 14280 words → 60 minutes
    expect(estimateReadingMinutes(14280)).toBe(60);
  });
});

describe("formatReadingTime", () => {
  test("formats zero as less than 1 min", () => {
    expect(formatReadingTime(0)).toBe("< 1 min");
  });

  test("formats minutes under 60", () => {
    expect(formatReadingTime(1)).toBe("1 min");
    expect(formatReadingTime(45)).toBe("45 min");
  });

  test("formats exact hours", () => {
    expect(formatReadingTime(60)).toBe("1 hr");
    expect(formatReadingTime(120)).toBe("2 hr");
  });

  test("formats hours with remaining minutes", () => {
    expect(formatReadingTime(90)).toBe("1 hr 30 min");
    expect(formatReadingTime(150)).toBe("2 hr 30 min");
    expect(formatReadingTime(61)).toBe("1 hr 1 min");
  });
});

describe("formatWordCount", () => {
  test("formats counts under 1000 as-is", () => {
    expect(formatWordCount(0)).toBe("0");
    expect(formatWordCount(500)).toBe("500");
    expect(formatWordCount(999)).toBe("999");
  });

  test("formats counts in the thousands with one decimal", () => {
    expect(formatWordCount(1000)).toBe("1.0k");
    expect(formatWordCount(1234)).toBe("1.2k");
    expect(formatWordCount(9999)).toBe("10.0k");
  });

  test("formats tens of thousands", () => {
    expect(formatWordCount(15678)).toBe("15.7k");
    expect(formatWordCount(50000)).toBe("50.0k");
  });

  test("formats hundreds of thousands as rounded k", () => {
    expect(formatWordCount(123456)).toBe("123k");
    expect(formatWordCount(500000)).toBe("500k");
  });
});
