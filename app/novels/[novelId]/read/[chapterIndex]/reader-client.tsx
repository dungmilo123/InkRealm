"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { UserMenu } from "@/components/user-menu";
import { GlossaryReader } from "./glossary-reader";
import type { ReadingPreferences } from "@/app/lib/reading-preferences";

type ReaderClientProps = {
  novelId: string;
  novelTitle: string;
  chapter: {
    index: number;
    title: string;
    paragraphs: string[];
  };
  chapterCount: number;
  preferences: ReadingPreferences;
  user: { name?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
  translatedParagraphs: string[] | null;
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
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
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
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
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
      </div>
    </div>
  );
}

export function ReaderClient({
  novelId,
  novelTitle,
  chapter,
  chapterCount,
  preferences: initialPreferences,
  user,
  signOutAction,
  translatedParagraphs,
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
  const settingsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fontFamilyClass = preferences.fontFamily === "SANS" ? "font-sans" : "font-serif";

  const previousChapterHref =
    chapter.index > 1 ? `/novels/${novelId}/read/${chapter.index - 1}` : null;
  const nextChapterHref =
    chapter.index < chapterCount
      ? `/novels/${novelId}/read/${chapter.index + 1}`
      : null;

  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="w-full border-b border-border bg-card">
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
          <GlossaryReader novelId={novelId} paragraphs={displayParagraphs} />
        </div>

        <nav className="mt-6 flex items-center justify-between gap-4">
          {previousChapterHref ? (
            <Link
              href={previousChapterHref}
              className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Previous chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground">
              Start of novel
            </span>
          )}

          {nextChapterHref ? (
            <Link
              href={nextChapterHref}
              className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-5 text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Next chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground">
              End of novel
            </span>
          )}
        </nav>
      </main>
    </div>
  );
}
