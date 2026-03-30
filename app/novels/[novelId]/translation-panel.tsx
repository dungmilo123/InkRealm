"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslationPolling } from "./use-translation-polling";

type TranslationProfile = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  initialProfiles: TranslationProfile[];
  initialJobs: TranslationJob[];
};

type FeedbackState = {
  type: "success" | "error";
  text: string;
};

const PROFILE_PROVIDER_OPTIONS = [
  "OPENAI",
  "ANTHROPIC",
  "DEEPSEEK",
  "OPENROUTER",
  "MINIMAX",
] as const;

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
  initialProfiles,
  initialJobs,
}: TranslationPanelProps) {
  const [profiles, setProfiles] = useState<TranslationProfile[]>(initialProfiles);
  const [jobs, setJobs] = useState<TranslationJob[]>(initialJobs);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState(false);

  const [targetLanguage, setTargetLanguage] = useState("Vietnamese");
  const [batchSize, setBatchSize] = useState("4");
  const [qualityPreset, setQualityPreset] = useState("fast");
  const [selectedProfileId, setSelectedProfileId] = useState(
    initialProfiles[0]?.id ?? ""
  );

  const [newProvider, setNewProvider] = useState<(typeof PROFILE_PROVIDER_OPTIONS)[number]>(
    "OPENAI"
  );
  const [newModel, setNewModel] = useState("gpt-4o-mini");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const hasProfiles = profiles.length > 0;
  const sortedJobs = useMemo(
    () => [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [jobs]
  );

  const handlePollingUpdate = useCallback(
    (updater: (prev: TranslationJob[]) => TranslationJob[]) => setJobs(updater),
    []
  );
  useTranslationPolling(jobs, handlePollingUpdate);

  async function refreshProfiles() {
    const response = await fetch("/api/translation/profiles", {
      method: "GET",
    });
    const data = await readJsonOrError<{ profiles: TranslationProfile[] }>(response);
    setProfiles(data.profiles);

    if (!data.profiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(data.profiles[0]?.id ?? "");
    }
  }

  async function refreshJobs() {
    const response = await fetch(`/api/translation/novels/${novelId}/jobs`, {
      method: "GET",
    });
    const data = await readJsonOrError<{ jobs: TranslationJob[] }>(response);
    setJobs(data.jobs);
  }

  async function handleCreateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/translation/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: newProvider,
          model: newModel,
          baseUrl: newBaseUrl || null,
          apiKey: newApiKey,
        }),
      });

      await readJsonOrError<{ profile: TranslationProfile }>(response);
      await refreshProfiles();
      setNewApiKey("");
      setFeedback({
        type: "success",
        text: "Translation profile saved.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleStartTranslation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/translation/novels/${novelId}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
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

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Translate this novel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create provider profiles, start translation jobs, monitor progress, and download
          completed exports.
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

      <form onSubmit={handleCreateProfile} className="space-y-3 border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-card-foreground">Provider profile</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Provider</span>
            <select
              value={newProvider}
              onChange={(event) =>
                setNewProvider(event.target.value as (typeof PROFILE_PROVIDER_OPTIONS)[number])
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROFILE_PROVIDER_OPTIONS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Model</span>
            <input
              value={newModel}
              onChange={(event) => setNewModel(event.target.value)}
              placeholder="gpt-4o-mini"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">Base URL (optional)</span>
            <input
              value={newBaseUrl}
              onChange={(event) => setNewBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">API key</span>
            <input
              type="password"
              value={newApiKey}
              onChange={(event) => setNewApiKey(event.target.value)}
              placeholder="Paste API key"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-9 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save profile"}
        </button>
      </form>

      {isReadable ? (
        <form onSubmit={handleStartTranslation} className="space-y-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-card-foreground">Start translation</h3>

          <div className="grid gap-3 md:grid-cols-3">
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
              <span className="text-xs text-muted-foreground">Provider profile</span>
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={!hasProfiles}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.provider} · {profile.model}
                  </option>
                ))}
              </select>
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

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !hasProfiles}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Working..." : "Start translation"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void Promise.all([refreshProfiles(), refreshJobs()]).catch((error) => {
                  setFeedback({
                    type: "error",
                    text:
                      error instanceof Error
                        ? error.message
                        : "Failed to refresh translation data.",
                  });
                });
              }}
              className="h-9 rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              Refresh data
            </button>
          </div>

          {!hasProfiles ? (
            <p className="text-xs text-muted-foreground">
              Add at least one provider profile before starting translation.
            </p>
          ) : null}
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
