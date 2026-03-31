"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import type { Novel } from "@/app/generated/prisma/client";

interface TranslationSummary {
  hasTranslation: boolean;
  translation?: {
    status: string;
    targetLanguage: string;
    totalChapters: number;
    completedChapters: number;
  };
}

interface NovelWithTranslation extends Novel {
  translation: TranslationSummary | null;
}

interface NovelCardProps {
  novel: NovelWithTranslation;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function TranslationBadge({ translation }: { translation: TranslationSummary | null }) {
  if (!translation?.hasTranslation || !translation.translation) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Not translated
      </span>
    );
  }

  const { status, targetLanguage, totalChapters, completedChapters } = translation.translation;
  const progress = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

  if (status === "COMPLETED") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        {targetLanguage} ✓
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        Failed
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        {targetLanguage} {status === "IN_PROGRESS" ? "translating" : status.toLowerCase()}
      </span>
      <div className="flex items-center gap-1">
        <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {completedChapters}/{totalChapters}
        </span>
      </div>
    </div>
  );
}

function NovelCard({ novel }: NovelCardProps) {
  return (
    <Link
      href={`/novels/${novel.id}`}
      className="group flex flex-col gap-2"
    >
      <BookCover
        title={novel.title}
        id={novel.id}
        fileType={novel.fileType}
        className="transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-1"
      />
      <div className="w-[120px]">
        <p className="text-xs font-medium text-foreground truncate leading-tight">
          {novel.title}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {novel.fileType.toUpperCase()} · {formatFileSize(novel.sizeBytes)}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {formatDate(novel.createdAt)}
        </p>
        <div className="mt-1">
          <TranslationBadge translation={novel.translation} />
        </div>
      </div>
    </Link>
  );
}

interface NovelListWithTranslationProps {
  initialNovels: Novel[];
}

const SHELF_SIZE = 5;

export function NovelListWithTranslation({ initialNovels }: NovelListWithTranslationProps) {
  const [novels, setNovels] = useState<NovelWithTranslation[]>(
    initialNovels.map((n) => ({ ...n, translation: null }))
  );

  useEffect(() => {
    async function fetchTranslations() {
      const novelsWithTranslation = await Promise.all(
        initialNovels.map(async (novel) => {
          try {
            const response = await fetch(`/api/translation/novel?novelId=${novel.id}`);
            if (response.ok) {
              const data = await response.json();
              return { ...novel, translation: data as TranslationSummary };
            }
          } catch {
            // ignore
          }
          return { ...novel, translation: null };
        })
      );
      setNovels(novelsWithTranslation);
    }

    fetchTranslations();
  }, [initialNovels]);

  if (novels.length === 0) {
    return null;
  }

  const shelves: NovelWithTranslation[][] = [];
  for (let i = 0; i < novels.length; i += SHELF_SIZE) {
    shelves.push(novels.slice(i, i + SHELF_SIZE));
  }

  return (
    <div className="space-y-6">
      {shelves.map((shelfNovels, idx) => (
        <div key={idx} className="mb-10 last:mb-0">
          <div className="flex flex-wrap gap-5">
            {shelfNovels.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[oklch(0.88_0.01_85)] shadow-inner" />
        </div>
      ))}
    </div>
  );
}