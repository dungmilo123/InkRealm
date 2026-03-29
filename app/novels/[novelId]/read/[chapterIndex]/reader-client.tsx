"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
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
};

function SettingsPopover({
  preferences,
  onChange,
}: {
  preferences: ReadingPreferences;
  onChange: (prefs: ReadingPreferences) => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
            className="w-full h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-primary"
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
            className="w-full h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-primary"
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
            className="w-full h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-primary"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              type="button"
              onClick={() => onChange({ ...preferences, theme: "LIGHT" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.theme === "LIGHT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Font</span>
          <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              type="button"
              onClick={() => onChange({ ...preferences, fontFamily: "SANS" })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                preferences.fontFamily === "SANS"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
}: ReaderClientProps) {
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

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  const isDark = preferences.theme === "DARK";
  const fontFamilyClass = preferences.fontFamily === "SANS" ? "font-sans" : "font-serif";

  const previousChapterHref =
    chapter.index > 1 ? `/novels/${novelId}/read/${chapter.index - 1}` : null;
  const nextChapterHref =
    chapter.index < chapterCount
      ? `/novels/${novelId}/read/${chapter.index + 1}`
      : null;

  return (
    <div className={`flex flex-col flex-1 ${isDark ? "dark bg-zinc-950" : "bg-zinc-50"}`}>
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm mb-3">
            <div className="flex items-center gap-x-4">
              <Link
                href={`/novels/${novelId}`}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Novel details
              </Link>
              <Link
                href="/dashboard"
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Library
              </Link>
            </div>
            <div className="flex items-center gap-x-3">
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors border ${
                    showSettings
                      ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {chapter.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {novelTitle} · Chapter {chapter.index} of {chapterCount}
          </p>
        </div>
      </header>

      <main
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
          <GlossaryReader novelId={novelId} paragraphs={chapter.paragraphs} />
        </div>

        <nav className="mt-6 flex items-center justify-between gap-4">
          {previousChapterHref ? (
            <Link
              href={previousChapterHref}
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 dark:border-zinc-700 px-5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Previous chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              Start of novel
            </span>
          )}

          {nextChapterHref ? (
            <Link
              href={nextChapterHref}
              className="inline-flex h-10 items-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Next chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              End of novel
            </span>
          )}
        </nav>
      </main>
    </div>
  );
}
