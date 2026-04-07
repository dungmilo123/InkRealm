import {
  extractSnippet,
  searchNovel,
  type SearchableChapter,
} from "./novel-search";

// ── extractSnippet ──────────────────────────────────────────────────────

describe("extractSnippet", () => {
  it("returns the full paragraph when it fits within context", () => {
    const text = "Hello world";
    const snippet = extractSnippet(text, 0, 5, 60);
    expect(snippet).toBe("Hello world");
  });

  it("adds leading ellipsis when truncated at the start", () => {
    const text = "The quick brown fox jumps over the lazy dog and then runs away fast";
    // Match "lazy" at offset 35
    const snippet = extractSnippet(text, 35, 4, 10);
    expect(snippet.startsWith("...")).toBeTruthy();
    expect(snippet).toContain("lazy");
  });

  it("adds trailing ellipsis when truncated at the end", () => {
    const text = "The quick brown fox jumps over the lazy dog and then runs away fast";
    // Match "quick" at offset 4
    const snippet = extractSnippet(text, 4, 5, 10);
    expect(snippet).toContain("quick");
    expect(snippet.endsWith("...")).toBeTruthy();
  });

  it("adds both ellipses when truncated at both ends", () => {
    const text =
      "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt";
    // Match "iii" somewhere in the middle
    const idx = text.indexOf("iii");
    const snippet = extractSnippet(text, idx, 3, 10);
    expect(snippet.startsWith("...")).toBeTruthy();
    expect(snippet.endsWith("...")).toBeTruthy();
    expect(snippet).toContain("iii");
  });

  it("respects custom contextChars parameter", () => {
    const text = "a ".repeat(100).trim(); // 199 chars
    const snippet = extractSnippet(text, 100, 1, 5);
    // With only 5 context chars, the snippet should be much shorter than the full text
    expect(snippet.length < text.length, "Snippet should be shorter than full text").toBeTruthy();
  });
});

// ── searchNovel ─────────────────────────────────────────────────────────

describe("searchNovel", () => {
  const chapters: SearchableChapter[] = [
    {
      index: 1,
      title: "The Beginning",
      paragraphs: [
        "The sun rose over the mountains.",
        "Alice walked into the garden.",
        "She found a mysterious book under the old oak tree.",
      ],
    },
    {
      index: 2,
      title: "The Journey",
      paragraphs: [
        "Alice continued walking through the forest.",
        "The trees whispered secrets.",
        "Alice found a hidden path.",
      ],
    },
    {
      index: 3,
      title: "The End",
      paragraphs: [
        "The sun set behind the mountains.",
        "Everything was peaceful.",
      ],
    },
  ];

  it("returns empty result for empty query", () => {
    const result = searchNovel(chapters, "");
    expect(result.totalMatches).toBe(0);
    expect(result.chaptersWithMatches).toBe(0);
    expect(result.chapters.length).toBe(0);
  });

  it("returns empty result for whitespace-only query", () => {
    const result = searchNovel(chapters, "   ");
    expect(result.totalMatches).toBe(0);
  });

  it("finds matches across multiple chapters", () => {
    const result = searchNovel(chapters, "Alice");
    expect(result.chaptersWithMatches).toBe(2);
    expect(result.totalMatches).toBe(3); // 1 in ch1, 2 in ch2
    expect(result.chapters[0].chapterIndex).toBe(1);
    expect(result.chapters[0].totalMatches).toBe(1);
    expect(result.chapters[1].chapterIndex).toBe(2);
    expect(result.chapters[1].totalMatches).toBe(2);
  });

  it("performs case-insensitive matching", () => {
    const result = searchNovel(chapters, "alice");
    expect(result.totalMatches).toBe(3);
    // Original text has "Alice" (capitalized), query is "alice" (lowercase)
    expect(result.chapters[0].matches[0].snippet).toContain("Alice");
  });

  it("returns chapter titles in results", () => {
    const result = searchNovel(chapters, "sun");
    expect(result.chapters[0].chapterTitle).toBe("The Beginning");
    expect(result.chapters[1].chapterTitle).toBe("The End");
  });

  it("omits chapters with no matches", () => {
    const result = searchNovel(chapters, "mysterious");
    expect(result.chaptersWithMatches).toBe(1);
    expect(result.chapters[0].chapterIndex).toBe(1);
  });

  it("preserves the original query in result", () => {
    const result = searchNovel(chapters, "  Alice  ");
    expect(result.query).toBe("Alice"); // trimmed
  });

  it("caps snippet collection per chapter via maxMatchesPerChapter", () => {
    // "the" appears many times in each chapter
    const result = searchNovel(chapters, "the", { maxMatchesPerChapter: 1 });
    // Each chapter should have at most 1 snippet but may have more total matches
    for (const ch of result.chapters) {
      expect(ch.matches.length <= 1, `Chapter ${ch.chapterIndex} has ${ch.matches.length} snippets, expected <= 1`).toBeTruthy();
      expect(ch.totalMatches >= ch.matches.length, "totalMatches should be >= snippets").toBeTruthy();
    }
    // Total matches should still count all occurrences
    expect(result.totalMatches > result.chapters.length, "Should count all matches even when snippets are capped").toBeTruthy();
  });

  it("returns correct match offsets", () => {
    const result = searchNovel(chapters, "mysterious");
    expect(result.chapters.length).toBe(1);
    const match = result.chapters[0].matches[0];
    expect(match.length).toBe("mysterious".length);
    // "She found a mysterious book..." - "mysterious" starts at index 12
    expect(match.startOffset).toBe(12);
  });

  it("generates context snippets that include the matched text", () => {
    const result = searchNovel(chapters, "hidden path");
    expect(result.chapters.length).toBe(1);
    const snippet = result.chapters[0].matches[0].snippet;
    expect(snippet).toContain("hidden path");
  });

  it("handles chapters with no paragraphs", () => {
    const emptyChapters: SearchableChapter[] = [
      { index: 1, title: "Empty", paragraphs: [] },
      { index: 2, title: "Has content", paragraphs: ["Hello world"] },
    ];
    const result = searchNovel(emptyChapters, "Hello");
    expect(result.chaptersWithMatches).toBe(1);
    expect(result.chapters[0].chapterIndex).toBe(2);
  });

  it("handles empty chapters array", () => {
    const result = searchNovel([], "anything");
    expect(result.totalMatches).toBe(0);
    expect(result.chapters.length).toBe(0);
  });

  it("finds multiple matches within a single paragraph", () => {
    const repeating: SearchableChapter[] = [
      {
        index: 1,
        title: "Repeat",
        paragraphs: ["the cat and the dog and the fish"],
      },
    ];
    const result = searchNovel(repeating, "the");
    expect(result.totalMatches).toBe(3);
  });

  it("respects custom snippetContextChars", () => {
    const longParagraph: SearchableChapter[] = [
      {
        index: 1,
        title: "Long",
        paragraphs: ["a ".repeat(200) + "FINDME" + " b".repeat(200)],
      },
    ];
    const narrow = searchNovel(longParagraph, "FINDME", { snippetContextChars: 10 });
    const wide = searchNovel(longParagraph, "FINDME", { snippetContextChars: 100 });
    expect(narrow.chapters[0].matches[0].snippet.length < wide.chapters[0].matches[0].snippet.length).toBeTruthy();
  });
});
