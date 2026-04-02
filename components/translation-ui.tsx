"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
  { value: "OPENAI", label: "OpenAI" },
  { value: "ANTHROPIC", label: "Anthropic" },
  { value: "DEEPSEEK", label: "DeepSeek" },
  { value: "OPENROUTER", label: "OpenRouter" },
  { value: "MINIMAX", label: "MiniMax" },
] as const;

const MODEL_OPTIONS: Record<string, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  DEEPSEEK: ["deepseek-chat", "deepseek-coder"],
  OPENROUTER: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "openai/gpt-4o-mini", "google/gemini-2.0-flash-thinking-exp"],
  MINIMAX: ["MiniMax-M2.7"],
};

const TARGET_LANGUAGES = [
  { value: "Vietnamese", label: "Vietnamese" },
];

interface TranslationSettingsFormProps {
  onSave: (settings: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  initialValues?: {
    provider: string;
    model: string;
    baseUrl?: string | null;
  };
}

export function TranslationSettingsForm({ onSave, initialValues }: TranslationSettingsFormProps) {
  const [provider, setProvider] = useState(initialValues?.provider || "OPENAI");
  const [model, setModel] = useState(initialValues?.model || MODEL_OPTIONS.OPENAI[0]);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initialValues?.baseUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel(MODEL_OPTIONS[newProvider]?.[0] || "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await onSave({
      provider,
      model,
      apiKey,
      baseUrl: baseUrl || undefined,
    });

    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setApiKey("");
    } else {
      setError(result.error || "Failed to save settings");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm">
          Settings saved successfully!
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="provider" className="text-sm font-medium text-foreground">
          Provider
        </label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="model" className="text-sm font-medium text-foreground">
          Model
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          {MODEL_OPTIONS[provider]?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="apiKey" className="text-sm font-medium text-foreground">
          API Key {initialValues?.provider && "(leave empty to keep current)"}
        </label>
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={initialValues?.provider ? "••••••••" : "Enter your API key"}
          required={!initialValues?.provider}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="baseUrl" className="text-sm font-medium text-foreground">
          Base URL (optional)
        </label>
        <Input
          id="baseUrl"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to use the default provider endpoint
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}

interface TranslationStartFormProps {
  onStart: (targetLanguage: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
}

export function TranslationStartForm({ onStart, disabled }: TranslationStartFormProps) {
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await onStart(targetLanguage);

    setLoading(false);
    if (!result.success) {
      setError(result.error || "Failed to start translation");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="targetLanguage" className="text-sm font-medium text-foreground">
          Target Language
        </label>
        <select
          id="targetLanguage"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
          disabled={disabled}
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={loading || disabled} className="w-full">
        {loading ? "Starting..." : "Start Translation"}
      </Button>
    </form>
  );
}

interface TranslationProgressProps {
  status: string;
  totalChapters: number;
  completedChapters: number;
  failedChapterIndex?: number;
  failureReason?: string;
  onResume?: () => Promise<void>;
  onDownload?: () => Promise<void>;
}

export function TranslationProgress({
  status,
  totalChapters,
  completedChapters,
  failedChapterIndex,
  failureReason,
  onResume,
  onDownload,
}: TranslationProgressProps) {
  const progress = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const isInProgress = status === "IN_PROGRESS" || status === "PENDING";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">
          {completedChapters} / {totalChapters} chapters
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(progress)}% complete</span>
        {isInProgress && <span className="animate-pulse">Translation in progress...</span>}
        {isFailed && <span className="text-destructive">Failed at chapter {failedChapterIndex}</span>}
        {isCompleted && <span className="text-green-600 dark:text-green-400">Completed!</span>}
      </div>

      {failureReason && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {failureReason}
        </div>
      )}

      <div className="flex gap-2">
        {isFailed && onResume && (
          <Button onClick={onResume} className="flex-1">
            Resume Translation
          </Button>
        )}
        {isCompleted && onDownload && (
          <Button onClick={onDownload} variant="default" className="flex-1">
            Download Translation
          </Button>
        )}
      </div>
    </div>
  );
}