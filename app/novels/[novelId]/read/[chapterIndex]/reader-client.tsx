"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { UserMenu } from "@/components/user-menu";
import { GlossaryReader } from "./glossary-reader";
import { useReaderKeyboardShortcuts } from "./use-reader-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { useScrollPosition } from "./use-scroll-position";
import { useChapterSearch } from "./use-chapter-search";
import { useBookmark } from "./use-bookmark";
import { SearchBar } from "./search-bar";
import { ChapterDrawer } from "./chapter-drawer";
import { BookmarkPanel } from "./bookmark-panel";
import { GoToChapterDialog } from "./go-to-chapter-dialog";
import { ChapterCompleteToast } from "./chapter-complete-toast";
import { NovelSearchDialog } from "./novel-search-dialog";
import { FontSizeIndicator } from "./font-size-indicator";
import { List, Search, Bookmark, BookmarkCheck, BookOpen } from "lucide-react";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";
import type { ReadingPreferences } from "@/app/lib/reading-preferences";

type ReaderClientProps = {
  novelId: string;
  novelTitle: string;
  chapter: {
    index: number;
    title: string;
    paragraphs: string[];
  };
  /** All chapter titles (with word counts) for the table of contents drawer */
  chapters: { index: number; title: string; wordCount: number }[];
  chapterCount: number;
  wordCount: number;
  preferences: ReadingPreferences;
  user: { name?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
  translatedParagraphs: string[] | null;
  /** Server-fetched initial bookmark state for this chapter */
  initialBookmarked: boolean;
  /** Chapter indices that the user has bookmarked in this novel */
  bookmarkedChapterIndices: number[];
  /** Chapter indices the user has already visited/read in this novel */
  visitedChapterIndices: number[];
  /** Server-fetched scroll position (0–1) for cross-device resume; null if no prior visit */
  initialScrollPosition: number | null;
};

function SettingsPopover({
  preferences,
  onChange,
}: {
  preferences: ReadingPreferences;
  onChange: (prefs: ReadingPreferences) => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Reading settings"
      className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
    >
      <h3 className="text-sm font-medium text-foreground mb-3">Reading Settings</h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Font Size</label>
            <span className="text-xs text-foreground font-medium">{preferences.fontSize}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={32}
            value={preferences.fontSize}
            onChange={(e) => onChange({ ...preferences, fontSize: Number(e.target.value) })}
            aria-label="Font size"
            aria-valuetext={`${preferences.fontSize} pixels`}
            className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Line Height</label>
            <span className="text-xs text-foreground font-medium">{preferences.lineHeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={125}
            max={250}
            value={Math.round(preferences.lineHeight * 100)}
            onChange={(e) => onChange({ ...preferences, lineHeight: Number(e.target.value) / 100 })}
            aria-label="Line height"
            aria-valuetext={`${Math.round(preferences.lineHeight * 100)}%`}
            className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Content Width</label>
            <span className="text-xs text-foreground font-medium">{preferences.maxWidth}px</span>
          </div>
          <input
            type="range"
            min={500}
            max={1000}
            step={20}
            value={preferences.maxWidth}
            onChange={(e) => onChange({ ...preferences, maxWidth: Number(e.target.value) })}
            aria-label="Content width"
            aria-valuetext={`${preferences.maxWidth} pixels`}
            className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Theme">
            <button
              type="button"
              aria-pressed={preferences.theme === "LIGHT"}
              onClick={() => onChange({ ...preferences, theme: "LIGHT" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.theme === "LIGHT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              aria-pressed={preferences.theme === "SEPIA"}
              onClick={() => onChange({ ...preferences, theme: "SEPIA" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.theme === "SEPIA"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Sepia
            </button>
            <button
              type="button"
              aria-pressed={preferences.theme === "DARK"}
              onClick={() => onChange({ ...preferences, theme: "DARK" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.theme === "DARK"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Font</span>
          <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Font family">
            <button
              type="button"
              aria-pressed={preferences.fontFamily === "SANS"}
              onClick={() => onChange({ ...preferences, fontFamily: "SANS" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.fontFamily === "SANS"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Sans
            </button>
            <button
              type="button"
              aria-pressed={preferences.fontFamily === "SERIF"}
              onClick={() => onChange({ ...preferences, fontFamily: "SERIF" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.fontFamily === "SERIF"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Serif
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Alignment</span>
          <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Text alignment">
            <button
              type="button"
              aria-pressed={preferences.textAlign === "LEFT"}
              onClick={() => onChange({ ...preferences, textAlign: "LEFT" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.textAlign === "LEFT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Left
            </button>
            <button
              type="button"
              aria-pressed={preferences.textAlign === "JUSTIFY"}
              onClick={() => onChange({ ...preferences, textAlign: "JUSTIFY" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.textAlign === "JUSTIFY"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Justify
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Spacing</span>
          <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Paragraph spacing">
            <button
              type="button"
              aria-pressed={preferences.paragraphSpacing === "COMPACT"}
              onClick={() => onChange({ ...preferences, paragraphSpacing: "COMPACT" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.paragraphSpacing === "COMPACT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              aria-pressed={preferences.paragraphSpacing === "NORMAL"}
              onClick={() => onChange({ ...preferences, paragraphSpacing: "NORMAL" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.paragraphSpacing === "NORMAL"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              aria-pressed={preferences.paragraphSpacing === "RELAXED"}
              onClick={() => onChange({ ...preferences, paragraphSpacing: "RELAXED" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.paragraphSpacing === "RELAXED"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Relaxed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FONT_SIZE_STEP = 2;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 32;

/**
 * Transient notification shown when Zen mode is activated.
 * Fades in, stays for 2s, then fades out. Always mounted for smooth CSS transitions.
 */
function ZenModeIndicator({ isZenMode }: { isZenMode: boolean }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isZenMode) {
      queueMicrotask(() => setVisible(true));
      timerRef.current = setTimeout(() => setVisible(false), 2000);
    } else {
      queueMicrotask(() => setVisible(false));
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isZenMode]);

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
      aria-live="polite"
    >
      <div className="rounded-full bg-foreground/90 text-background px-4 py-1.5 text-sm font-medium shadow-lg backdrop-blur-sm">
        Zen mode · press <kbd className="font-mono mx-0.5">Z</kbd> to exit
      </div>
    </div>
  );
}

export function ReaderClient({
  novelId,
  novelTitle,
  chapter,
  chapters,
  chapterCount,
  wordCount,
  preferences: initialPreferences,
  user,
  signOutAction,
  translatedParagraphs,
  initialBookmarked,
  bookmarkedChapterIndices,
  visitedChapterIndices,
  initialScrollPosition,
}: ReaderClientProps) {
  const hasTranslation = translatedParagraphs !== null && translatedParagraphs.length > 0;
  // D-07: Default to translated when available
  const [showTranslated, setShowTranslated] = useState(hasTranslation);

  // Determine which content to display
  const displayParagraphs = showTranslated && translatedParagraphs
    ? translatedParagraphs
    : chapter.paragraphs;

  const [preferences, setPreferences] = useState(initialPreferences);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [showGoToChapter, setShowGoToChapter] = useState(false);
  const [showNovelSearch, setShowNovelSearch] = useState(false);
  const [glossaryMode, setGlossaryMode] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [zenHeaderPeek, setZenHeaderPeek] = useState(false);
  const zenPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll position persistence + reading progress tracking
  const { progress: scrollProgress } = useScrollPosition({
    novelId,
    chapterIndex: chapter.index,
    serverScrollPosition: initialScrollPosition,
  });

  // In-chapter text search
  const search = useChapterSearch({ paragraphs: displayParagraphs });

  // Bookmark state with optimistic toggle
  const bookmark = useBookmark({
    novelId,
    chapterIndex: chapter.index,
    initialBookmarked,
  });

  // Build a set of bookmarked chapter indices for the TOC drawer,
  // kept in sync with the current chapter's optimistic bookmark state
  const bookmarkedSet = useMemo(() => {
    const set = new Set(bookmarkedChapterIndices);
    if (bookmark.isBookmarked) {
      set.add(chapter.index);
    } else {
      set.delete(chapter.index);
    }
    return set;
  }, [bookmarkedChapterIndices, bookmark.isBookmarked, chapter.index]);

  // Compute prev/next bookmarked chapter hrefs for [ / ] keyboard navigation.
  // Sorted ascending so we can find the nearest bookmark before/after current chapter.
  const previousBookmarkHref = useMemo(() => {
    const sorted = Array.from(bookmarkedSet).sort((a, b) => a - b);
    const prev = sorted.findLast((idx) => idx < chapter.index);
    return prev !== undefined ? `/novels/${novelId}/read/${prev}` : null;
  }, [bookmarkedSet, chapter.index, novelId]);

  const nextBookmarkHref = useMemo(() => {
    const sorted = Array.from(bookmarkedSet).sort((a, b) => a - b);
    const next = sorted.find((idx) => idx > chapter.index);
    return next !== undefined ? `/novels/${novelId}/read/${next}` : null;
  }, [bookmarkedSet, chapter.index, novelId]);

  // Build a set of visited (read) chapter indices for the TOC drawer.
  // The current chapter is always included since visiting the page records it.
  const visitedSet = useMemo(() => {
    const set = new Set(visitedChapterIndices);
    set.add(chapter.index);
    return set;
  }, [visitedChapterIndices, chapter.index]);

  const previousChapterHref =
    chapter.index > 1 ? `/novels/${novelId}/read/${chapter.index - 1}` : null;
  const nextChapterHref =
    chapter.index < chapterCount
      ? `/novels/${novelId}/read/${chapter.index + 1}`
      : null;

  const toggleTranslation = useCallback(() => {
    if (hasTranslation) setShowTranslated((v) => !v);
  }, [hasTranslation]);
  const toggleSettings = useCallback(() => setShowSettings((v) => !v), []);
  const toggleGlossary = useCallback(() => setGlossaryMode((v) => !v), []);
  const toggleChapterDrawer = useCallback(() => setShowChapterDrawer((v) => !v), []);
  const toggleBookmarkPanel = useCallback(() => setShowBookmarkPanel((v) => !v), []);
  const toggleGoToChapter = useCallback(() => setShowGoToChapter((v) => !v), []);
  const toggleNovelSearch = useCallback(() => setShowNovelSearch((v) => !v), []);
  const toggleHelp = useCallback(() => setShowHelp((v) => !v), []);
  const toggleZenMode = useCallback(() => {
    setIsZenMode((v) => !v);
    setZenHeaderPeek(false);
  }, []);

  const savePreferences = useCallback((prefs: ReadingPreferences) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetch("/api/reading/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    }, 300);
  }, []);

  const handlePreferencesChange = useCallback(
    (prefs: ReadingPreferences) => {
      setPreferences(prefs);
      savePreferences(prefs);
    },
    [savePreferences]
  );

  const increaseFontSize = useCallback(() => {
    setPreferences((prev) => {
      const next = Math.min(prev.fontSize + FONT_SIZE_STEP, FONT_SIZE_MAX);
      if (next === prev.fontSize) return prev;
      const updated = { ...prev, fontSize: next };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  const decreaseFontSize = useCallback(() => {
    setPreferences((prev) => {
      const next = Math.max(prev.fontSize - FONT_SIZE_STEP, FONT_SIZE_MIN);
      if (next === prev.fontSize) return prev;
      const updated = { ...prev, fontSize: next };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  const toggleTextAlign = useCallback(() => {
    setPreferences((prev) => {
      const updated = { ...prev, textAlign: prev.textAlign === "LEFT" ? "JUSTIFY" as const : "LEFT" as const };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  useReaderKeyboardShortcuts({
    previousChapterHref,
    nextChapterHref,
    toggleTranslation: hasTranslation ? toggleTranslation : undefined,
    toggleSettings,
    toggleGlossary,
    toggleChapterDrawer,
    toggleHelp,
    toggleSearch: search.toggle,
    toggleBookmark: bookmark.toggle,
    toggleBookmarkPanel,
    toggleGoToChapter,
    toggleNovelSearch,
    increaseFontSize,
    decreaseFontSize,
    toggleZenMode,
    toggleTextAlign,
    previousBookmarkHref,
    nextBookmarkHref,
  });

  // Close popover on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showSettings]);

  // Zen mode: auto-peek header when mouse is near the top of the viewport
  useEffect(() => {
    if (!isZenMode) return;

    function handleMouseMove(e: MouseEvent) {
      if (e.clientY <= 60) {
        // Mouse near top — show header
        setZenHeaderPeek(true);
        if (zenPeekTimerRef.current) clearTimeout(zenPeekTimerRef.current);
      } else if (e.clientY > 200) {
        // Mouse moved away — hide header after a short delay
        if (zenPeekTimerRef.current) clearTimeout(zenPeekTimerRef.current);
        zenPeekTimerRef.current = setTimeout(() => {
          setZenHeaderPeek(false);
        }, 800);
      }
    }

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (zenPeekTimerRef.current) clearTimeout(zenPeekTimerRef.current);
    };
  }, [isZenMode]);

  // Exit Zen mode when any overlay opens (they need the toolbar)
  useEffect(() => {
    if (isZenMode && (showChapterDrawer || showBookmarkPanel || showHelp || showGoToChapter || showNovelSearch || showSettings)) {
      queueMicrotask(() => {
        setIsZenMode(false);
        setZenHeaderPeek(false);
      });
    }
  }, [isZenMode, showChapterDrawer, showBookmarkPanel, showHelp, showGoToChapter, showNovelSearch, showSettings]);

  const fontFamilyClass = preferences.fontFamily === "SANS" ? "font-sans" : "font-serif";

  return (
    <div
      className="flex flex-col flex-1 bg-background text-foreground transition-colors duration-200"
      data-reader-theme={preferences.theme.toLowerCase()}
    >
      {/* Reading progress indicator — fixed thin bar at top of viewport */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-0.5 bg-muted/30 transition-opacity duration-300 ${
          isZenMode && !zenHeaderPeek ? "opacity-0" : "opacity-100"
        }`}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <div
          className="h-full bg-primary/70 transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {search.isOpen && (
        <SearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          totalMatches={search.matches.length}
          activeMatchIndex={search.activeMatchIndex}
          onNext={search.goToNext}
          onPrev={search.goToPrev}
          onClose={search.close}
        />
      )}

      <header
        className={`w-full border-b border-border bg-card transition-all duration-300 ease-in-out ${
          isZenMode && !zenHeaderPeek
            ? "-translate-y-full opacity-0 absolute"
            : "translate-y-0 opacity-100 relative"
        }`}
      >
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm mb-3">
            <Breadcrumbs
              items={[
                { label: "Dashboard", href: "/dashboard" },
                { label: novelTitle, href: `/novels/${novelId}` },
                { label: chapter.title },
              ]}
            />
            <div className="flex items-center gap-x-3">
              <button
                type="button"
                onClick={bookmark.toggle}
                disabled={bookmark.isPending}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors border ${
                  bookmark.isBookmarked
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                } ${bookmark.isPending ? "opacity-60" : ""}`}
                aria-label={bookmark.isBookmarked ? "Remove bookmark" : "Bookmark this chapter"}
                aria-pressed={bookmark.isBookmarked}
                title={bookmark.isBookmarked ? "Remove bookmark (B)" : "Bookmark this chapter (B)"}
              >
                {bookmark.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleBookmarkPanel}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors border ${
                  showBookmarkPanel
                    ? "bg-muted border-border"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Bookmarks panel"
                aria-expanded={showBookmarkPanel}
                title="Bookmarks panel (Shift+B)"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={toggleChapterDrawer}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors border ${
                  showChapterDrawer
                    ? "bg-muted border-border"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Table of contents"
                aria-expanded={showChapterDrawer}
                title="Table of contents (C)"
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={search.toggle}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors border ${
                  search.isOpen
                    ? "bg-muted border-border"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Search in chapter"
                aria-expanded={search.isOpen}
                title="Search in chapter (F)"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              {hasTranslation && (
                <div
                  className="flex rounded-md border border-border overflow-hidden"
                  role="radiogroup"
                  aria-label="Content version"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!showTranslated}
                    onClick={() => setShowTranslated(false)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      !showTranslated
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={showTranslated}
                    onClick={() => setShowTranslated(true)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      showTranslated
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Translated
                  </button>
                </div>
              )}
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors border ${
                    showSettings
                      ? "bg-muted border-border"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  aria-label="Reading settings"
                  aria-expanded={showSettings}
                >
                  Aa
                </button>
                {showSettings && (
                  <SettingsPopover
                    preferences={preferences}
                    onChange={handlePreferencesChange}
                  />
                )}
              </div>
              <UserMenu user={user} signOutAction={signOutAction} />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {chapter.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {novelTitle} · Chapter {chapter.index} of {chapterCount}
            {wordCount > 0 && (
              <span className="ml-1">
                · {formatReadingTime(estimateReadingMinutes(wordCount))} read
              </span>
            )}
            {scrollProgress > 0.01 && (
              <span className="ml-1">
                · {Math.round(scrollProgress * 100)}%
              </span>
            )}
            {wordCount > 0 && scrollProgress >= 0.05 && scrollProgress <= 0.95 && (
              <span className="ml-1">
                · ~{formatReadingTime(estimateReadingMinutes(Math.round(wordCount * (1 - scrollProgress))))} left
              </span>
            )}
          </p>
        </div>
      </header>

      <main
        id="main"
        className="w-full mx-auto px-8 py-8"
        style={{ maxWidth: `${preferences.maxWidth}px` }}
      >
        <div
          className={fontFamilyClass}
          style={{
            fontSize: `${preferences.fontSize}px`,
            lineHeight: preferences.lineHeight,
          }}
        >
          <GlossaryReader
            novelId={novelId}
            paragraphs={displayParagraphs}
            glossaryMode={glossaryMode}
            onToggleGlossary={toggleGlossary}
            searchMatches={search.matches}
            activeSearchMatchIndex={search.activeMatchIndex}
            textAlign={preferences.textAlign}
            paragraphSpacing={preferences.paragraphSpacing}
          />
        </div>

        <nav
          className={`mt-6 flex items-center justify-between gap-4 transition-all duration-300 ${
            isZenMode ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
          }`}
        >
          {previousChapterHref ? (
            <Link
              href={previousChapterHref}
              className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              ← Previous chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground">
              Start of novel
            </span>
          )}

          <button
            type="button"
            onClick={toggleHelp}
            className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <kbd className="font-mono">?</kbd>
          </button>

          {nextChapterHref ? (
            <Link
              href={nextChapterHref}
              className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-5 text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Next chapter →
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground">
              End of novel
            </span>
          )}
        </nav>
      </main>

      {showChapterDrawer && (
        <ChapterDrawer
          novelId={novelId}
          chapters={chapters}
          currentChapterIndex={chapter.index}
          bookmarkedChapterIndices={bookmarkedSet}
          visitedChapterIndices={visitedSet}
          onClose={toggleChapterDrawer}
        />
      )}

      {showBookmarkPanel && (
        <BookmarkPanel
          novelId={novelId}
          novelTitle={novelTitle}
          currentChapterIndex={chapter.index}
          chapters={chapters}
          onClose={toggleBookmarkPanel}
        />
      )}

      {showHelp && (
        <KeyboardShortcutsHelp
          onClose={toggleHelp}
          hasTranslation={hasTranslation}
          hasGlossary={true}
        />
      )}

      {showGoToChapter && (
        <GoToChapterDialog
          novelId={novelId}
          chapters={chapters}
          currentChapterIndex={chapter.index}
          chapterCount={chapterCount}
          onClose={toggleGoToChapter}
        />
      )}

      {showNovelSearch && (
        <NovelSearchDialog
          novelId={novelId}
          currentChapterIndex={chapter.index}
          chapterCount={chapterCount}
          onClose={toggleNovelSearch}
        />
      )}

      <ChapterCompleteToast
        scrollProgress={scrollProgress}
        currentChapterIndex={chapter.index}
        chapterCount={chapterCount}
        novelId={novelId}
        chapters={chapters}
      />

      <FontSizeIndicator
        fontSize={preferences.fontSize}
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
      />

      {/* Zen mode entry hint — fades in briefly then disappears */}
      <ZenModeIndicator isZenMode={isZenMode} />
    </div>
  );
}
