"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { X, BookmarkCheck, MessageSquare, Pencil, Check, Download } from "lucide-react";
import { useBookmarkPanel } from "./use-bookmark-panel";
import {
  formatBookmarksAsMarkdown,
  generateExportFilename,
} from "@/lib/bookmark-export";

type BookmarkPanelProps = {
  novelId: string;
  novelTitle: string;
  currentChapterIndex: number;
  /** Chapter titles for display — same array as ChapterDrawer */
  chapters: { index: number; title: string }[];
  onClose: () => void;
};

/**
 * Right-side slide-out drawer showing all bookmarks for the current novel.
 *
 * Each bookmark displays chapter number, title, optional note, and date.
 * Users can edit notes inline and click through to bookmarked chapters.
 *
 * Design mirrors ChapterDrawer (left-side) for visual consistency,
 * but slides in from the right to avoid collision.
 */
export function BookmarkPanel({
  novelId,
  novelTitle,
  currentChapterIndex,
  chapters,
  onClose,
}: BookmarkPanelProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const activeBookmarkRef = useRef<HTMLAnchorElement>(null);
  const { bookmarks, isLoading, error, updateNote, refresh } = useBookmarkPanel({
    novelId,
    isOpen: true,
  });

  // Build a map from chapter index to title for quick lookups
  const chapterTitleMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ch of chapters) {
      map.set(ch.index, ch.title);
    }
    return map;
  }, [chapters]);

  // Auto-scroll the current chapter's bookmark into view on mount
  useEffect(() => {
    if (!isLoading && activeBookmarkRef.current) {
      activeBookmarkRef.current.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }
  }, [isLoading]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  // ── Export bookmarks as markdown ──────────────────────────────────
  const handleExport = useCallback(() => {
    if (bookmarks.length === 0) return;

    const markdown = formatBookmarksAsMarkdown({
      novelTitle,
      bookmarks,
      chapterTitles: chapterTitleMap,
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generateExportFilename(novelTitle);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [bookmarks, novelTitle, chapterTitleMap]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm">
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Chapter bookmarks"
        className="fixed inset-y-0 right-0 z-[91] w-80 max-w-[85vw] bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Bookmarks
            {!isLoading && (
              <span className="text-xs font-normal text-muted-foreground">
                ({bookmarks.length})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {!isLoading && bookmarks.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Export bookmarks as markdown"
                title="Export bookmarks (.md)"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close bookmarks"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          )}

          {error && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !error && bookmarks.length === 0 && (
            <div className="px-4 py-12 text-center">
              <BookmarkCheck className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No bookmarks yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Press <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">B</kbd> while reading to bookmark a chapter
              </p>
            </div>
          )}

          {!isLoading && !error && bookmarks.length > 0 && (
            <div className="py-1">
              {bookmarks.map((bm) => {
                const isCurrent = bm.chapterIndex === currentChapterIndex;
                const title = chapterTitleMap.get(bm.chapterIndex) ?? `Chapter ${bm.chapterIndex}`;
                return (
                  <BookmarkItem
                    key={bm.id}
                    bookmark={bm}
                    chapterTitle={title}
                    isCurrent={isCurrent}
                    novelId={novelId}
                    onUpdateNote={updateNote}
                    onClose={onClose}
                    ref={isCurrent ? activeBookmarkRef : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Individual Bookmark Item ──────────────────────────────────────

import { forwardRef } from "react";

type BookmarkItemProps = {
  bookmark: {
    id: string;
    chapterIndex: number;
    note: string | null;
    createdAt: string;
  };
  chapterTitle: string;
  isCurrent: boolean;
  novelId: string;
  onUpdateNote: (bookmarkId: string, note: string | null) => void;
  onClose: () => void;
};

const BookmarkItem = forwardRef<HTMLAnchorElement, BookmarkItemProps>(
  function BookmarkItem(
    { bookmark, chapterTitle, isCurrent, novelId, onUpdateNote, onClose },
    ref
  ) {
    const [isEditing, setIsEditing] = useState(false);
    const [noteText, setNoteText] = useState(bookmark.note ?? "");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus textarea when entering edit mode
    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(noteText.length, noteText.length);
      }
    }, [isEditing, noteText.length]);

    const saveNote = useCallback(() => {
      const trimmed = noteText.trim();
      const finalNote = trimmed.length > 0 ? trimmed : null;
      // Only save if it actually changed
      if (finalNote !== bookmark.note) {
        onUpdateNote(bookmark.id, finalNote);
      }
      setIsEditing(false);
    }, [noteText, bookmark.id, bookmark.note, onUpdateNote]);

    const handleNoteKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          saveNote();
        }
        if (e.key === "Escape") {
          e.stopPropagation(); // Don't close panel
          setNoteText(bookmark.note ?? "");
          setIsEditing(false);
        }
      },
      [saveNote, bookmark.note]
    );

    const dateStr = new Date(bookmark.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    return (
      <div
        className={`px-4 py-3 border-b border-border/50 transition-colors ${
          isCurrent ? "bg-primary/5" : "hover:bg-muted/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`tabular-nums text-xs mt-0.5 shrink-0 ${
              isCurrent ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            Ch. {bookmark.chapterIndex}
          </span>
          <div className="flex-1 min-w-0">
            <Link
              ref={ref}
              href={`/novels/${novelId}/read/${bookmark.chapterIndex}`}
              onClick={onClose}
              className={`text-sm leading-snug hover:underline block truncate ${
                isCurrent ? "text-primary font-medium" : "text-foreground"
              }`}
              aria-current={isCurrent ? "page" : undefined}
            >
              {chapterTitle}
            </Link>
            <span className="text-xs text-muted-foreground/70">{dateStr}</span>

            {/* Note display / edit */}
            {isEditing ? (
              <div className="mt-1.5">
                <textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value.slice(0, 500))}
                  onBlur={saveNote}
                  onKeyDown={handleNoteKeyDown}
                  placeholder="Add a note..."
                  maxLength={500}
                  rows={2}
                  className="w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground/50">
                    {noteText.length}/500
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur from firing first
                      saveNote();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1 group/note">
                {bookmark.note ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-start gap-1.5 text-left w-full"
                  >
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {bookmark.note}
                    </span>
                    <Pencil className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 group-hover/note:opacity-100 transition-opacity" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    + Add note
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
