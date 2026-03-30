"use client";

import { useState, useCallback } from "react";

type GlossaryVariant = {
  id: string;
  variant: string;
};

type GlossaryEntry = {
  id: string;
  novelId: string;
  canonical: string;
  type: string;
  status: string;
  variants: GlossaryVariant[];
  createdAt: string;
  updatedAt: string;
};

type ReplacementMatch = {
  chapterId: string;
  chapterIndex: number;
  translatedTitle: string | null;
  matches: Array<{
    variant: string;
    occurrences: number;
    contextSnippets: string[];
  }>;
};

type GlossaryPanelProps = {
  novelId: string;
};

type FeedbackState = {
  type: "success" | "error";
  text: string;
};

const ENTRY_TYPES = ["CHARACTER", "PLACE", "TECHNIQUE", "OTHER"] as const;

async function readJsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

function typeBadgeClass(type: string) {
  switch (type) {
    case "CHARACTER": return "bg-blue-100 text-blue-800";
    case "PLACE": return "bg-emerald-100 text-emerald-800";
    case "TECHNIQUE": return "bg-purple-100 text-purple-800";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusBadgeClass(status: string) {
  return status === "CONFIRMED"
    ? "bg-green-100 text-green-800"
    : "bg-amber-100 text-amber-800";
}

export function GlossaryPanel({ novelId }: GlossaryPanelProps) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState(false);

  // Add/Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCanonical, setFormCanonical] = useState("");
  const [formType, setFormType] = useState<(typeof ENTRY_TYPES)[number]>("CHARACTER");
  const [formVariants, setFormVariants] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Preview modal state
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);
  const [previewMatches, setPreviewMatches] = useState<ReplacementMatch[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/translation/novels/${novelId}/glossary`);
      const data = await readJsonOrError<{ entries: GlossaryEntry[] }>(res);
      setEntries(data.entries);
      setLoaded(true);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load glossary.",
      });
    }
  }, [novelId]);

  // Load on first render
  if (!loaded && !busy) {
    void fetchEntries();
  }

  const confirmedEntries = entries.filter((e) => e.status === "CONFIRMED");
  const pendingEntries = entries.filter((e) => e.status === "PENDING");

  function resetForm() {
    setEditingId(null);
    setFormCanonical("");
    setFormType("CHARACTER");
    setFormVariants("");
    setShowAddForm(false);
  }

  function startEdit(entry: GlossaryEntry) {
    setEditingId(entry.id);
    setFormCanonical(entry.canonical);
    setFormType(entry.type as (typeof ENTRY_TYPES)[number]);
    setFormVariants(entry.variants.map((v) => v.variant).join(", "));
    setShowAddForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);

    const variants = formVariants
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    try {
      if (editingId) {
        const res = await fetch(
          `/api/translation/novels/${novelId}/glossary/${editingId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canonical: formCanonical, type: formType, variants }),
          }
        );
        await readJsonOrError(res);
        setFeedback({ type: "success", text: "Entry updated." });
      } else {
        const res = await fetch(`/api/translation/novels/${novelId}/glossary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonical: formCanonical, type: formType, variants }),
        });
        await readJsonOrError(res);
        setFeedback({ type: "success", text: "Entry created." });
      }
      resetForm();
      await fetchEntries();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save entry.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entryId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entryId}`,
        { method: "DELETE" }
      );
      await readJsonOrError(res);
      setFeedback({ type: "success", text: "Entry deleted." });
      await fetchEntries();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete entry.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(entryId: string, canonical?: string, type?: string, variants?: string[]) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "CONFIRMED",
            ...(canonical && { canonical }),
            ...(type && { type }),
            ...(variants && { variants }),
          }),
        }
      );
      await readJsonOrError(res);
      setFeedback({ type: "success", text: "Entry confirmed." });
      await fetchEntries();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to confirm entry.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss(entryId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DISMISSED" }),
        }
      );
      await readJsonOrError(res);
      setFeedback({ type: "success", text: "Entry dismissed." });
      await fetchEntries();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to dismiss entry.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview(entryId: string) {
    setPreviewEntryId(entryId);
    setPreviewLoading(true);
    setPreviewMatches([]);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entryId}/preview`
      );
      const data = await readJsonOrError<{ matches: ReplacementMatch[] }>(res);
      setPreviewMatches(data.matches);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load preview.",
      });
      setPreviewEntryId(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApply(entryId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/translation/novels/${novelId}/glossary/${entryId}/apply`,
        { method: "POST" }
      );
      const data = await readJsonOrError<{ chaptersUpdated: number; totalReplacements: number }>(res);
      setFeedback({
        type: "success",
        text: `Applied: ${data.totalReplacements} replacements across ${data.chaptersUpdated} chapters.`,
      });
      setPreviewEntryId(null);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to apply replacements.",
      });
    } finally {
      setBusy(false);
    }
  }

  function renderEntry(entry: GlossaryEntry, showReviewActions: boolean) {
    return (
      <article key={entry.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-foreground">{entry.canonical}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeClass(entry.type)}`}>
            {entry.type}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(entry.status)}`}>
            {entry.status}
          </span>
        </div>

        {entry.variants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.variants.map((v) => (
              <span key={v.id} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {v.variant}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {showReviewActions ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleConfirm(entry.id)}
                className="h-7 rounded-md bg-green-600 px-2.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startEdit(entry)}
                className="h-7 rounded-md border border-input px-2.5 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-60"
              >
                Edit & Confirm
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDismiss(entry.id)}
                className="h-7 rounded-md bg-red-600 px-2.5 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Dismiss
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => startEdit(entry)}
                className="h-7 rounded-md border border-input px-2.5 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(entry.id)}
                className="h-7 rounded-md border border-red-200 px-2.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
              {entry.variants.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePreview(entry.id)}
                  className="h-7 rounded-md border border-input px-2.5 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-60"
                >
                  Apply to chapters
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Glossary</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage terminology for consistent translations across chapters.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowAddForm(!showAddForm); }}
          className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showAddForm ? "Cancel" : "Add entry"}
        </button>
      </div>

      {feedback && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          feedback.type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.text}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="space-y-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-card-foreground">
            {editingId ? "Edit glossary entry" : "New glossary entry"}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Canonical term</span>
              <input
                value={formCanonical}
                onChange={(e) => setFormCanonical(e.target.value)}
                placeholder="e.g. Trương Tam"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Type</span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as (typeof ENTRY_TYPES)[number])}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-muted-foreground">Variants (comma-separated)</span>
              <input
                value={formVariants}
                onChange={(e) => setFormVariants(e.target.value)}
                placeholder="e.g. Truong Tam, Trương Ba"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Saving..." : editingId ? "Update entry" : "Create entry"}
          </button>
        </form>
      )}

      {/* Preview modal */}
      {previewEntryId && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-card-foreground">
              Preview replacements
            </h3>
            <button
              type="button"
              onClick={() => setPreviewEntryId(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          ) : previewMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches found in translated chapters.</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {previewMatches.map((m) => (
                  <div key={m.chapterId} className="rounded-md border border-border bg-background p-2 text-xs">
                    <p className="font-medium text-foreground">
                      Chapter {m.chapterIndex}: {m.translatedTitle ?? "Untitled"}
                    </p>
                    {m.matches.map((match, i) => (
                      <div key={i} className="mt-1 text-muted-foreground">
                        <span className="font-medium">&quot;{match.variant}&quot;</span> - {match.occurrences} occurrence(s)
                        {match.contextSnippets.slice(0, 1).map((s, j) => (
                          <p key={j} className="mt-0.5 text-[10px] text-muted-foreground/70 truncate">{s}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleApply(previewEntryId)}
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Applying..." : "Apply replacements"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Pending entries (review section) */}
      {pendingEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-amber-800">
            Pending review ({pendingEntries.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Terms detected by the LLM during translation. Confirm to keep or dismiss to remove.
          </p>
          <div className="space-y-2">
            {pendingEntries.map((entry) => renderEntry(entry, true))}
          </div>
        </div>
      )}

      {/* Confirmed entries */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-card-foreground">
          Confirmed entries ({confirmedEntries.length})
        </h3>
        {confirmedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No glossary entries yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {confirmedEntries.map((entry) => renderEntry(entry, false))}
          </div>
        )}
      </div>
    </section>
  );
}
