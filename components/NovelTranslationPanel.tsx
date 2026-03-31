"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TranslationSettingsForm, TranslationStartForm, TranslationProgress } from "@/components/translation-ui";

interface TranslationChapter {
  chapterIndex: number;
  originalTitle: string;
  status: string;
  hasTranslation: boolean;
}

interface TranslationData {
  hasTranslation: boolean;
  translation?: {
    id: string;
    novelId: string;
    targetLanguage: string;
    status: string;
    totalChapters: number;
    completedChapters: number;
    failedChapterIndex?: number;
    failureReason?: string;
    chapters: TranslationChapter[];
  };
}

interface NovelTranslationPanelProps {
  novelId: string;
  isReadable: boolean;
}

export function NovelTranslationPanel({
  novelId,
  isReadable,
}: NovelTranslationPanelProps) {
  const [translationData, setTranslationData] = useState<TranslationData | null>(null);
  const [settingsConfigured, setSettingsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const fetchTranslationData = useCallback(async () => {
    try {
      const [novelRes, settingsRes] = await Promise.all([
        fetch(`/api/translation/novel?novelId=${novelId}`),
        fetch("/api/translation/settings"),
      ]);

      if (novelRes.ok) {
        const novelData = await novelRes.json();
        setTranslationData(novelData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettingsConfigured(settingsData.configured);
      }
    } catch (error) {
      console.error("Failed to fetch translation data:", error);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    fetchTranslationData();
  }, [fetchTranslationData]);

  const handleSaveSettings = async (settings: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl?: string;
  }) => {
    const response = await fetch("/api/translation/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    const data = await response.json();
    if (response.ok) {
      setSettingsConfigured(true);
      setShowSettings(false);
      await fetchTranslationData();
      return { success: true };
    }
    return { success: false, error: data.error };
  };

  const handleStartTranslation = async (targetLanguage: string) => {
    const response = await fetch("/api/translation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        novelId,
        targetLanguage,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      await fetchTranslationData();
      await handleResumeTranslation(data.translationId);
      return { success: true };
    }
    return { success: false, error: data.error };
  };

  const handleResumeTranslation = async (translationId?: string) => {
    const id = translationId || translationData?.translation?.id;
    if (!id) return;

    const response = await fetch("/api/translation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resume",
        translationId: id,
      }),
    });

    if (response.ok) {
      await fetchTranslationData();
    } else {
      const data = await response.json();
      alert(data.error || "Failed to resume translation");
    }
  };

  const handleDownload = async () => {
    const response = await fetch(`/api/translation/download?novelId=${novelId}`);
    const data = await response.json();

    if (response.ok && data.downloadPath) {
      window.location.href = data.downloadPath;
    } else {
      alert(data.error || "Failed to generate download");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-1/4" />
      </div>
    );
  }

  if (!isReadable) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Translation is not available for this novel because it cannot be read in the app.
        </p>
      </div>
    );
  }

  const hasTranslation = translationData?.hasTranslation;
  const translation = translationData?.translation;
  const isCompleted = translation?.status === "COMPLETED";
  const isFailed = translation?.status === "FAILED";
  const isInProgress = translation?.status === "IN_PROGRESS" || translation?.status === "PENDING";
  const hasAnyTranslation = hasTranslation && translation;

  return (
    <div className="space-y-4">
      <div className="border-t border-border pt-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Translation</h3>

        {!hasAnyTranslation && !settingsConfigured && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure your translation provider to start translating this novel.
            </p>
            <Button onClick={() => setShowSettings(!showSettings)}>
              Configure Translation
            </Button>
            {showSettings && (
              <div className="mt-4 p-4 border rounded-lg bg-card">
                <TranslationSettingsForm onSave={handleSaveSettings} />
              </div>
            )}
          </div>
        )}

        {!hasAnyTranslation && settingsConfigured && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Translation is ready to start. Select a target language to begin.
            </p>
            <TranslationStartForm onStart={handleStartTranslation} />
            <Button variant="ghost" onClick={() => setShowSettings(!showSettings)} className="text-xs">
              Update translation settings
            </Button>
            {showSettings && (
              <div className="mt-4 p-4 border rounded-lg bg-card">
                <TranslationSettingsForm
                  onSave={handleSaveSettings}
                  initialValues={{
                    provider: translationData?.translation?.id ? "OPENAI" : "OPENAI",
                    model: "gpt-4o",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {hasAnyTranslation && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {translation.targetLanguage} translation
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                isCompleted ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                isFailed ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                isInProgress ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}>
                {translation.status}
              </span>
            </div>

            <TranslationProgress
              status={translation.status}
              totalChapters={translation.totalChapters}
              completedChapters={translation.completedChapters}
              failedChapterIndex={translation.failedChapterIndex}
              failureReason={translation.failureReason}
              onResume={isFailed ? () => handleResumeTranslation() : undefined}
              onDownload={isCompleted ? handleDownload : undefined}
            />

            {isCompleted && (
              <div className="flex gap-2">
                <Link
                  href={`/novels/${novelId}/read/1?version=translated`}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Read Translation
                </Link>
              </div>
            )}

            {(isFailed || isInProgress) && (
              <Button variant="ghost" onClick={() => setShowSettings(!showSettings)} className="text-xs">
                Update settings
              </Button>
            )}

            {showSettings && (
              <div className="mt-4 p-4 border rounded-lg bg-card">
                <TranslationSettingsForm
                  onSave={handleSaveSettings}
                  initialValues={{
                    provider: "OPENAI",
                    model: "gpt-4o",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}