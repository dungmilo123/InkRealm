"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useTranslationPolling } from "./use-translation-polling";

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
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
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

type TranslationPanelProps = {
  novelId: string;
  isReadable: boolean;
  defaultProfile: DefaultProfileInfo;
  initialJobs: TranslationJob[];
};

type FeedbackState = {
  type: "success" | "error";
  text: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusBadgeClass(status: TranslationJob["status"]) {
  if (status === "COMPLETED") {
    return "bg-green-100 text-green-800";
  }

  if (status === "FAILED") {
    return "bg-red-100 text-red-800";
  }

  if (status === "IN_PROGRESS") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-muted text-muted-foreground";
}

async function readJsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export function TranslationPanel({
  novelId,
  isReadable,
  defaultProfile,
  initialJobs,
}: TranslationPanelProps) {
  const [jobs, setJobs] = useState<TranslationJob[]>(initialJobs);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState(false);

  const [targetLanguage, setTargetLanguage] = useState("Vietnamese");
  const [batchSize, setBatchSize] = useState("4");
  const [qualityPreset, setQualityPreset] = useState("fast");

  const sortedJobs = useMemo(
    () => [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [jobs]
  );

  const handlePollingUpdate = useCallback(
    (updater: (prev: TranslationJob[]) => TranslationJob[]) => setJobs(updater),
    []
  );
  useTranslationPolling(jobs, handlePollingUpdate);

  async function refreshJobs() {
    const response = await fetch(`/api/translation/novels/${novelId}/jobs`, {
      method: "GET",
    });
    const data = await readJsonOrError<{ jobs: TranslationJob[] }>(response);
    setJobs(data.jobs);
  }

  async function handleStartTranslation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!defaultProfile) return;
    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/translation/novels/${novelId}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: defaultProfile.id,
          targetLanguage,
          batchSize: Number.parseInt(batchSize, 10),
          qualityPreset,
        }),
      });

      const data = await readJsonOrError<{ job: TranslationJob }>(response);
      setJobs((prev) => [data.job, ...prev.filter((job) => job.id !== data.job.id)]);
      setFeedback({
        type: "success",
        text: "Translation job created and started.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start translation.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function runNextBatch(jobId: string) {
    setBusy(true);
    setFeedback(null);

    // Optimistic: set to IN_PROGRESS so polling activates immediately
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId && job.status !== "IN_PROGRESS"
          ? { ...job, status: "IN_PROGRESS" as const }
          : job
      )
    );

    try {
      const response = await fetch(`/api/translation/jobs/${jobId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchSize: Number.parseInt(batchSize, 10),
        }),
      });

      const data = await readJsonOrError<{ job: TranslationJob }>(response);
      setJobs((prev) => prev.map((job) => (job.id === data.job.id ? data.job : job)));
      setFeedback({ type: "success", text: "Processed the next translation batch." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to run translation batch.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(jobId: string) {
    setBusy(true);
    setFeedback(null);

    // Optimistic: set to IN_PROGRESS so polling activates immediately
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, status: "IN_PROGRESS" as const } : job
      )
    );

    try {
      const response = await fetch(`/api/translation/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchSize: Number.parseInt(batchSize, 10),
        }),
      });

      const data = await readJsonOrError<{ job: TranslationJob }>(response);
      setJobs((prev) => prev.map((job) => (job.id === data.job.id ? data.job : job)));
      setFeedback({
        type: "success",
        text: "Retry started from the failed chapter.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to retry translation.",
      });
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>
            Using <strong className="text-foreground">{defaultProfile.provider} &middot; {defaultProfile.model}</strong>
          </span>
          <span>&middot;</span>
          <Link
            href="/settings"
            className="text-primary hover:underline text-sm"
          >
            Change in Settings
          </Link>
        </div>
        <h2 className="text-lg font-semibold text-card-foreground">Translate this novel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start translation jobs, monitor progress, and download completed exports.
        </p>
      </div>

      {feedback ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {isReadable ? (
        <form onSubmit={handleStartTranslation} className="space-y-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-card-foreground">Start translation</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Target language</span>
              <input
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Batch size</span>
              <input
                type="number"
                min={1}
                max={20}
                value={batchSize}
                onChange={(event) => setBatchSize(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">Quality preset</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {([
                { value: "fast", label: "Fast", desc: "No glossary, no context. Fastest speed." },
                { value: "standard", label: "Standard", desc: "Glossary + 1 previous chapter + 3 summaries." },
                { value: "premium", label: "Premium", desc: "Glossary + 3 previous chapters + 5 summaries." },
              ] as const).map((preset) => (
                <label
                  key={preset.value}
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${
                    qualityPreset === preset.value
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="qualityPreset"
                      value={preset.value}
                      checked={qualityPreset === preset.value}
                      onChange={(e) => setQualityPreset(e.target.value)}
                      className="accent-primary"
                    />
                    <span className="font-medium">{preset.label}</span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">{preset.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Working..." : "Start translation"}
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          In-app reading is unavailable for this novel, so translation start controls are hidden.
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-card-foreground">Translation jobs</h3>
        {sortedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No translation jobs yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedJobs.map((job) => {
              const isTerminal = job.status === "COMPLETED" || job.status === "FAILED";
              const canRunMore =
                (job.status === "PENDING" || job.status === "IN_PROGRESS") &&
                job.completedChapters < job.totalChapters;

              return (
                <article key={job.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {job.targetLanguage} translation
                    </h4>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(job.status)}`}
                    >
                      {job.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.providerSnapshot} · {job.modelSnapshot}
                  </p>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm text-foreground mb-1">
                      <span>
                        {job.completedChapters}/{job.totalChapters} chapters ({job.progressPercent}%)
                      </span>
                      {job.status === "COMPLETED" ? (
                        <span className="text-xs font-medium text-green-700">Complete</span>
                      ) : null}
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          job.status === "COMPLETED"
                            ? "bg-green-500"
                            : job.status === "FAILED"
                              ? "bg-red-400"
                              : "bg-amber-400"
                        }`}
                        style={{ width: `${job.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {job.failureReason ? (
                    <p className="mt-2 text-xs text-red-700">
                      Failed at chapter {job.failedChapterIndex ?? "unknown"}: {job.failureReason}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {formatDateTime(job.updatedAt)}
                    {isTerminal ? " · terminal" : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canRunMore ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void runNextBatch(job.id);
                        }}
                        className="h-8 rounded-md border border-input px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                      >
                        Run next batch
                      </button>
                    ) : null}

                    {job.status === "FAILED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void retryJob(job.id);
                        }}
                        className="h-8 rounded-md border border-input px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                      >
                        Retry
                      </button>
                    ) : null}

                    {job.downloadUrl ? (
                      <a
                        href={job.downloadUrl}
                        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Download export
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
