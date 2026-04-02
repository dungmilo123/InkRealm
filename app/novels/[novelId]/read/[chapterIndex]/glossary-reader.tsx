"use client";

import { useState, useEffect } from "react";
import { readJsonOrError } from "@/lib/fetch";
import { SearchHighlightedText } from "./search-highlighted-text";
import type { SearchMatch } from "@/lib/chapter-search";

type GlossaryVariant = {
  id: string;
  variant: string;
};

type GlossaryEntry = {
  id: string;
  canonical: string;
  type: string;
  status: string;
  variants: GlossaryVariant[];
};

type GlossaryReaderProps = {
  novelId: string;
  paragraphs: string[];
  /** When provided, glossary mode is controlled by the parent */
  glossaryMode?: boolean;
  /** Called when the glossary toggle button is clicked (controlled mode) */
  onToggleGlossary?: () => void;
  /** Search matches to highlight (optional, from chapter search) */
  searchMatches?: SearchMatch[];
  /** Index of the currently active search match */
  activeSearchMatchIndex?: number;
};

function GlossaryPopover({
  entry,
  novelId,
  onClose,
  onUpdate,
}: {
  entry: GlossaryEntry;
  novelId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [editCanonical, setEditCanonical] = useState(entry.canonical);
  const [editVariants, setEditVariants] = useState(
    entry.variants.map((v) => v.variant).join(", ")
  );
  const [editType, setEditType] = useState(entry.type);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApplyOffer, setShowApplyOffer] = useState(false);
  const [applyPreview, setApplyPreview] = useState<{ chapter: string; count: number }[] | null>(null);
  const [applying, setApplying] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const variants = editVariants.split(",").map((v) => v.trim()).filter(Boolean);
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entry.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canonical: editCanonical,
            type: editType,
            variants,
          }),
        }
      );
      await readJsonOrError(res);
      onUpdate();
      setEditing(false);
      setShowApplyOffer(true);
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreviewApply() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entry.id}/preview`
      );
      const data = await readJsonOrError<{ matches: { chapterTitle: string; occurrences: number }[] }>(res);
      setApplyPreview(data.matches.map((m) => ({ chapter: m.chapterTitle, count: m.occurrences })));
    } catch (err) {
      console.warn("[glossary] preview failed for entry", entry.id, err);
      setApplyPreview([]);
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setError(null);
    setApplying(true);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entry.id}/apply`,
        { method: "POST" }
      );
      await readJsonOrError(res);
      setShowApplyOffer(false);
      setApplyPreview(null);
      onUpdate();
    } catch {
      setError("Could not apply changes. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="absolute z-50 mt-1 w-72 rounded-lg border border-border bg-card p-3 shadow-lg text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-foreground">{entry.canonical}</span>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Type: {entry.type} | Status: {entry.status}</p>
        {entry.variants.length > 0 && (
          <p>Variants: {entry.variants.map((v) => v.variant).join(", ")}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
      )}

      {showApplyOffer ? (
        <div className="mt-2 space-y-2">
          {applyPreview === null ? (
            <>
              <p className="text-xs text-muted-foreground">Apply this change to other translated chapters?</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePreviewApply}
                  className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? "Loading..." : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApplyOffer(false)}
                  className="h-7 rounded-md border border-input px-2 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  Skip
                </button>
              </div>
            </>
          ) : applyPreview.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches found in other chapters.</p>
          ) : (
            <>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {applyPreview.map((m, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {m.chapter}: {m.count} match{m.count !== 1 ? "es" : ""}
                  </p>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={applying}
                  onClick={handleApply}
                  className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {applying ? "Applying..." : "Apply All"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowApplyOffer(false); setApplyPreview(null); }}
                  className="h-7 rounded-md border border-input px-2 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : !editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 h-7 rounded-md border border-input px-2 text-[11px] font-medium text-foreground hover:bg-accent"
        >
          Edit
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            value={editCanonical}
            onChange={(e) => setEditCanonical(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            placeholder="Canonical term"
            aria-label="Canonical term"
          />
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Entry type"
          >
            {["CHARACTER", "PLACE", "TECHNIQUE", "OTHER"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={editVariants}
            onChange={(e) => setEditVariants(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            placeholder="Variants (comma-separated)"
            aria-label="Variants (comma-separated)"
          />
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-7 rounded-md border border-input px-2 text-[11px] font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightedParagraph({
  text,
  paragraphIndex,
  entries,
  glossaryMode,
  novelId,
  onUpdate,
  searchMatches,
  activeSearchMatchIndex,
}: {
  text: string;
  paragraphIndex: number;
  entries: GlossaryEntry[];
  glossaryMode: boolean;
  novelId: string;
  onUpdate: () => void;
  searchMatches?: SearchMatch[];
  activeSearchMatchIndex?: number;
}) {
  const [activeEntry, setActiveEntry] = useState<GlossaryEntry | null>(null);

  const hasSearch = searchMatches && searchMatches.length > 0;

  // Helper to render text with optional search highlighting
  function renderText(content: string) {
    if (!hasSearch) return content;
    return (
      <SearchHighlightedText
        text={content}
        paragraphIndex={paragraphIndex}
        matches={searchMatches}
        activeMatchIndex={activeSearchMatchIndex ?? -1}
      />
    );
  }

  if (!glossaryMode || entries.length === 0) {
    return <p>{renderText(text)}</p>;
  }

  // Build a list of all terms to highlight (canonical + variants)
  const termMap = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    termMap.set(entry.canonical, entry);
    for (const v of entry.variants) {
      termMap.set(v.variant, entry);
    }
  }

  // Sort terms by length (longest first) to match greedily
  const terms = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <p>{text}</p>;

  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  );

  const parts = text.split(pattern);

  return (
    <p className="relative">
      {parts.map((part, i) => {
        const entry = termMap.get(part);
        if (!entry) return <span key={i}>{renderText(part)}</span>;

        return (
          <span key={i} className="relative inline">
            <button
              type="button"
              onClick={() => setActiveEntry(activeEntry?.id === entry.id ? null : entry)}
              aria-label={`View glossary for "${part}"`}
              className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 rounded px-0.5 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800/60 transition-colors"
            >
              {part}
            </button>
            {activeEntry?.id === entry.id && (
              <GlossaryPopover
                entry={entry}
                novelId={novelId}
                onClose={() => setActiveEntry(null)}
                onUpdate={() => {
                  setActiveEntry(null);
                  onUpdate();
                }}
              />
            )}
          </span>
        );
      })}
    </p>
  );
}

export function GlossaryReader({ novelId, paragraphs, glossaryMode: controlledMode, onToggleGlossary, searchMatches, activeSearchMatchIndex }: GlossaryReaderProps) {
  const [internalMode, setInternalMode] = useState(false);
  const glossaryMode = controlledMode ?? internalMode;
  const handleToggle = onToggleGlossary ?? (() => setInternalMode((m) => !m));
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function fetchEntries() {
    try {
      const res = await fetch(`/api/translation/novels/${novelId}/glossary`);
      const data = await readJsonOrError<{ entries: GlossaryEntry[] }>(res);
      setEntries(data.entries);
      setLoaded(true);
    } catch (err) {
      console.warn("[glossary] Failed to fetch entries for novel", novelId, err);
    }
  }

  useEffect(() => {
    if (!glossaryMode || loaded) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/translation/novels/${novelId}/glossary`);
        const data = await readJsonOrError<{ entries: GlossaryEntry[] }>(res);
        if (!cancelled) {
          setEntries(data.entries);
          setLoaded(true);
        }
      } catch (err) {
        console.warn("[glossary] Failed to fetch entries for novel", novelId, err);
      }
    })();

    return () => { cancelled = true; };
  }, [glossaryMode, loaded, novelId]);

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => handleToggle()}
          aria-expanded={glossaryMode}
          aria-label="Toggle glossary highlighting"
          className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
            glossaryMode
              ? "bg-yellow-100 text-yellow-900 border border-yellow-300 hover:bg-yellow-200"
              : "border border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {glossaryMode ? "Glossary: ON" : "Glossary: OFF"}
        </button>
      </div>

      <article className="p-6 md:p-8 bg-card rounded-lg border border-border space-y-6 leading-8 text-foreground">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <HighlightedParagraph
            key={paragraphIndex}
            text={paragraph}
            paragraphIndex={paragraphIndex}
            entries={entries}
            glossaryMode={glossaryMode}
            novelId={novelId}
            onUpdate={() => void fetchEntries()}
            searchMatches={searchMatches}
            activeSearchMatchIndex={activeSearchMatchIndex}
          />
        ))}
      </article>
    </>
  );
}
