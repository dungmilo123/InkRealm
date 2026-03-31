"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReaderSummary } from "@/app/lib/reader";
import { TranslationPanel } from "./translation-panel";
import { GlossaryPanel } from "./glossary-panel";
import type {
  SerializedDefaultProfile,
  SerializedTranslationJob,
} from "./novel-details-view";

type ReadingProgressData = {
  lastChapterIndex: number;
  visitedChapterIndices: number[];
} | null;

type DetailsTabsProps = {
  novelId: string;
  readerSummary: ReaderSummary;
  readingProgress: ReadingProgressData;
  isReadable: boolean;
  serializedDefaultProfile: SerializedDefaultProfile;
  serializedLatestJob: SerializedTranslationJob | null;
  chapterCount: number;
};

const TABS = ["Chapters", "Translation", "Glossary"] as const;
type Tab = (typeof TABS)[number];

function ChapterList({
  novelId,
  chapters,
  readingProgress,
}: {
  novelId: string;
  chapters: { index: number; title: string }[];
  readingProgress: ReadingProgressData;
}) {
  const visitedSet = new Set(readingProgress?.visitedChapterIndices ?? []);
  const lastChapter = readingProgress?.lastChapterIndex ?? null;

  return (
    <div className="divide-y divide-border">
      {chapters.map((ch) => {
        const isLast = ch.index === lastChapter;
        const isVisited = visitedSet.has(ch.index);

        let indicator: string;
        let indicatorClass: string;
        if (isLast) {
          indicator = "\u25C9"; // ◉
          indicatorClass = "text-primary";
        } else if (isVisited) {
          indicator = "\u2713"; // ✓
          indicatorClass = "text-green-600 dark:text-green-400";
        } else {
          indicator = "\u25CB"; // ○
          indicatorClass = "text-muted-foreground/50";
        }

        return (
          <Link
            key={ch.index}
            href={`/novels/${novelId}/read/${ch.index}`}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors group"
          >
            <span className={`text-sm w-5 text-center ${indicatorClass}`}>
              {indicator}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums w-8">
              {ch.index}
            </span>
            <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {ch.title}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function DetailsTabs({
  novelId,
  readerSummary,
  readingProgress,
  isReadable,
  serializedDefaultProfile,
  serializedLatestJob,
  chapterCount,
}: DetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Chapters");

  return (
    <div>
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === "Chapters" && (
          readerSummary.isReadable && readerSummary.chapters ? (
            <ChapterList
              novelId={novelId}
              chapters={readerSummary.chapters}
              readingProgress={readingProgress}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Chapter list is not available for this novel.
            </p>
          )
        )}

        {activeTab === "Translation" && (
          <TranslationPanel
            novelId={novelId}
            isReadable={isReadable}
            defaultProfile={serializedDefaultProfile}
            initialJob={serializedLatestJob}
            chapterCount={chapterCount}
          />
        )}

        {activeTab === "Glossary" && <GlossaryPanel novelId={novelId} />}
      </div>
    </div>
  );
}
