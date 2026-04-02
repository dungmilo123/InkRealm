"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Play,
  X,
  Download,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DefaultProfileInfo = {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
} | null;

type TranslationJob = {
  id: string;
  novelId: string;
  targetLanguage: string;
  providerSnapshot: string;
  modelSnapshot: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalChapters: number;
  completedChapters: number;
  failedChapterIndex: number | null;
  failureReason: string | null;
  exportPath: string | null;
  createdAt: string;
  updatedAt: string;
  progressPercent: number;
  downloadUrl: string | null;
};

type ChapterStatus = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
};

type TranslationPanelProps = {
  novelId: string;
  isReadable: boolean;
  defaultProfile: DefaultProfileInfo;
  job: TranslationJob | null;
  onJobUpdate: (job: TranslationJob | null) => void;
  isHanging: boolean;
  hangingChapterIndex: number | null;
  chapterCount: number;
  chapterStatuses: ChapterStatus[];
};

type PanelState = "idle" | "translating" | "completed" | "failed" | "cancelled";

function getPanelState(job: TranslationJob | null): PanelState {
  if (!job) return "idle";
  if (job.status === "CANCELLED") return "cancelled";
  if (job.status === "COMPLETED") return "completed";
  if (job.status === "FAILED") return "failed";
  if (job.status === "IN_PROGRESS" || job.status === "PENDING") return "translating";
  return "idle";
}

async function readJsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

/**
 * UI panel for managing and observing a translation job for a novel.
 *
 * Renders controls to start, monitor, cancel, retry, and complete translation jobs,
 * displays progress and errors, and provides an optional chapter range picker.
 *
 * @param novelId - Identifier of the novel to translate
 * @param isReadable - Whether the novel is readable in-app; when false, translation controls are disabled
 * @param defaultProfile - The selected translation provider profile; when null, a setup prompt is shown
 * @param job - Current translation job state (may be `null`)
 * @param onJobUpdate - Callback invoked with an updated `TranslationJob` or `null` to replace the current job state
 * @param isHanging - Whether the current job appears to be stuck on a chapter
 * @param hangingChapterIndex - Index of the chapter suspected to be hanging (when `isHanging` is true)
 * @param chapterCount - Total number of chapters in the novel
 * @param chapterStatuses - Per-chapter statuses used to compute live progress while translating
 * @returns The translation panel React element
 */
export function TranslationPanel({
  novelId,
  isReadable,
  defaultProfile,
  job,
  onJobUpdate,
  isHanging,
  hangingChapterIndex,
  chapterCount,
  chapterStatuses,
}: TranslationPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRange, setShowRange] = useState(false);
  const [chapterFrom, setChapterFrom] = useState("");
  const [chapterTo, setChapterTo] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const panelState = getPanelState(job);

  // Derive progress from chapter statuses (accurate during translation)
  const liveTranslatedCount = chapterStatuses.filter((s) => s.status === "translated").length;
  const liveTotalChapters = job?.totalChapters ?? chapterCount;
  const liveProgressPercent = liveTotalChapters > 0
    ? Math.round((liveTranslatedCount / liveTotalChapters) * 100)
    : 0;

  // Range validation
  const fromNum = chapterFrom ? Number.parseInt(chapterFrom, 10) : null;
  const toNum = chapterTo ? Number.parseInt(chapterTo, 10) : null;
  let rangeError: string | null = null;
  if (fromNum !== null && (fromNum < 1 || fromNum > chapterCount)) {
    rangeError = `From must be between 1 and ${chapterCount}`;
  } else if (toNum !== null && (toNum < 1 || toNum > chapterCount)) {
    rangeError = `To must be between 1 and ${chapterCount}`;
  } else if (fromNum !== null && toNum !== null && fromNum > toNum) {
    rangeError = "From must be less than or equal to To";
  }

  async function handleStartTranslation() {
    if (!defaultProfile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { profileId: defaultProfile.id };
      if (chapterFrom) body.chapterFrom = Number.parseInt(chapterFrom, 10);
      if (chapterTo) body.chapterTo = Number.parseInt(chapterTo, 10);

      const res = await fetch(`/api/translation/novels/${novelId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrError<{ job: TranslationJob }>(res);
      onJobUpdate(data.job);
      toast.success("Translation started");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start translation.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!job || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/translation/jobs/${job.id}/cancel`, {
        method: "POST",
      });
      const data = await readJsonOrError<{ job: TranslationJob }>(res);
      onJobUpdate(data.job);
      setCancelDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel translation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    if (!job || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/translation/jobs/${job.id}/retry`, {
        method: "POST",
      });
      const data = await readJsonOrError<{ job: TranslationJob }>(res);
      onJobUpdate(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry translation.");
    } finally {
      setBusy(false);
    }
  }

  function handleRestart() {
    onJobUpdate(null);
    setChapterFrom("");
    setChapterTo("");
    setShowRange(false);
    setError(null);
  }

  // No provider configured
  if (!defaultProfile) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Settings2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground">No provider configured</p>
          <p className="text-sm text-muted-foreground">
            Set up a translation provider to get started.
          </p>
          <Link
            href="/settings"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Go to Settings &rarr;
          </Link>
        </div>
      </section>
    );
  }

  const providerNote = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <span>
        Using{" "}
        <strong className="text-foreground">
          {defaultProfile.provider} &middot; {defaultProfile.model}
        </strong>
      </span>
      <span>&middot;</span>
      <Link href="/settings" className="text-primary hover:underline text-sm">
        Change in Settings
      </Link>
    </div>
  );

  // Not readable
  if (!isReadable) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        {providerNote}
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          In-app reading is unavailable for this novel, so translation is disabled.
        </div>
      </section>
    );
  }

  // Determine if all chapters are translated (for re-translate label)
  const allTranslated =
    job?.status === "COMPLETED" && job.completedChapters >= chapterCount;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {providerNote}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
          {error}
        </div>
      ) : null}

      {/* Idle state */}
      {(panelState === "idle" || panelState === "cancelled") && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-heading font-semibold text-card-foreground">
              Translate this novel
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {allTranslated
                ? "All chapters translated · Vietnamese · Premium quality"
                : `${chapterCount - (job?.completedChapters ?? 0)} chapters untranslated · Vietnamese · Premium quality`}
            </p>
            {panelState === "cancelled" && job ? (
              <p className="text-xs text-muted-foreground mt-1">
                Previous translation was cancelled. {job.completedChapters}{" "}
                chapters already translated will be kept.
              </p>
            ) : null}
          </div>

          <Button
            className="w-full h-10 px-6 text-sm font-medium"
            disabled={busy || !!rangeError}
            aria-busy={busy}
            onClick={() => void handleStartTranslation()}
          >
            <Play className="h-4 w-4 mr-2" />
            {allTranslated ? "Re-translate" : "Translate"}
          </Button>

          {/* Advanced range picker */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setShowRange(!showRange)}
            >
              {showRange ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide chapter range
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Advanced: Set chapter range
                </>
              )}
            </button>

            {showRange ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="chapter-from" className="text-sm text-muted-foreground">
                      From chapter
                    </Label>
                    <Input
                      id="chapter-from"
                      type="number"
                      min={1}
                      max={chapterCount}
                      value={chapterFrom}
                      onChange={(e) => setChapterFrom(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <span className="pb-2 text-muted-foreground">→</span>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="chapter-to" className="text-sm text-muted-foreground">
                      To chapter
                    </Label>
                    <Input
                      id="chapter-to"
                      type="number"
                      min={1}
                      max={chapterCount}
                      value={chapterTo}
                      onChange={(e) => setChapterTo(e.target.value)}
                      placeholder={String(chapterCount)}
                    />
                  </div>
                </div>
                {rangeError ? (
                  <p className="text-xs text-destructive">{rangeError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Translating state */}
      {panelState === "translating" && job && (
        <div className="space-y-3">
          <h2
            className="text-xl font-heading font-semibold text-card-foreground"
            aria-live="polite"
          >
            Translating...
          </h2>

          <div
            role="progressbar"
            aria-valuenow={liveProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Translation progress"
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out"
              style={{ width: `${liveProgressPercent}%` }}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {liveTranslatedCount} of {liveTotalChapters} chapters translated (
            {liveProgressPercent}%)
          </p>

          <div className="flex justify-end">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => setCancelDialogOpen(true)}
            >
              <X className="h-3.5 w-3.5 mr-2" />
              Stop Translation
            </Button>
          </div>

          {isHanging ? (
            <div
              role="status"
              className="rounded-lg border border-border bg-muted/50 px-4 py-3 mt-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Translation may be stuck — chapter {hangingChapterIndex} has
                    been running for 10+ minutes.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can cancel and retry from this chapter.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Cancel confirmation dialog */}
          <AlertDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel translation?</AlertDialogTitle>
                <AlertDialogDescription>
                  Translation will stop after the current chapter finishes.
                  Already-translated chapters will be kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Translating</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleCancel()}>
                  Cancel Translation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Completed state */}
      {panelState === "completed" && job && (
        <div className="space-y-4" aria-live="polite">
          <div>
            <h2 className="text-xl font-heading font-semibold text-card-foreground">
              Translation complete
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {job.totalChapters} chapters translated to Vietnamese
            </p>
          </div>

          {job.downloadUrl ? (
            <a
              href={job.downloadUrl}
              download
              className={buttonVariants({ className: "w-full h-10 px-6" })}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Translation
            </a>
          ) : null}

          <div className="flex justify-center mt-2">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline"
              onClick={handleRestart}
            >
              Re-translate all chapters
            </button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {panelState === "failed" && job && (
        <div className="space-y-4" aria-live="polite">
          <h2 className="text-xl font-heading font-semibold text-card-foreground">
            Translation stopped
          </h2>

          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-destructive">
                  Failed at chapter {job.failedChapterIndex ?? "unknown"}:{" "}
                  {job.failureReason}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Already-translated chapters are preserved. Retry resumes from
                  chapter {job.failedChapterIndex ?? "unknown"}.
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-10 px-6"
            onClick={() => void handleRetry()}
            disabled={busy}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry from Chapter {job.failedChapterIndex ?? "unknown"}
          </Button>

          <div className="flex justify-center mt-2">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline"
              onClick={handleRestart}
            >
              Start over from chapter 1
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
