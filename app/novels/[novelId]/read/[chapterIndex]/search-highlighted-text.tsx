"use client";

import { useEffect, useRef } from "react";
import type { SearchMatch } from "@/lib/chapter-search";

type SearchHighlightedTextProps = {
  /** The original text content */
  text: string;
  /** Index of this paragraph in the paragraphs array */
  paragraphIndex: number;
  /** All search matches across the chapter */
  matches: SearchMatch[];
  /** Index of the currently active match (-1 if none) */
  activeMatchIndex: number;
};

/**
 * Renders text with search match highlighting.
 * The active match gets a distinct style and auto-scrolls into view.
 *
 * This component is designed to wrap plain text segments —
 * it can be used inside glossary-highlighted spans too.
 */
export function SearchHighlightedText({
  text,
  paragraphIndex,
  matches,
  activeMatchIndex,
}: SearchHighlightedTextProps) {
  const activeRef = useRef<HTMLElement>(null);

  // Auto-scroll the active match into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  });

  // Filter matches for this paragraph
  const paragraphMatches = matches.filter(
    (m) => m.paragraphIndex === paragraphIndex
  );

  if (paragraphMatches.length === 0) {
    return <>{text}</>;
  }

  // Build text segments with highlights
  const segments: { text: string; isMatch: boolean; isActive: boolean }[] = [];
  let lastEnd = 0;

  for (const match of paragraphMatches) {
    // Find the global index of this match in the full matches array
    const globalIndex = matches.findIndex(
      (m) =>
        m.paragraphIndex === match.paragraphIndex &&
        m.startOffset === match.startOffset
    );
    const isActive = globalIndex === activeMatchIndex;

    // Text before this match
    if (match.startOffset > lastEnd) {
      segments.push({
        text: text.slice(lastEnd, match.startOffset),
        isMatch: false,
        isActive: false,
      });
    }

    // The match itself
    segments.push({
      text: text.slice(match.startOffset, match.startOffset + match.length),
      isMatch: true,
      isActive,
    });

    lastEnd = match.startOffset + match.length;
  }

  // Remaining text after last match
  if (lastEnd < text.length) {
    segments.push({
      text: text.slice(lastEnd),
      isMatch: false,
      isActive: false,
    });
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.isMatch) {
          return <span key={i}>{seg.text}</span>;
        }

        return (
          <mark
            key={i}
            ref={seg.isActive ? activeRef : undefined}
            className={
              seg.isActive
                ? "bg-primary/40 text-foreground rounded-sm px-px ring-2 ring-primary/60"
                : "bg-yellow-300/50 dark:bg-yellow-500/30 text-foreground rounded-sm px-px"
            }
          >
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}
