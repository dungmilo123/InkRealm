"use client";

import { useMemo, useState } from "react";
import type { Novel } from "@/app/generated/prisma/client";
import { NovelList } from "./NovelList";
import type { NovelProgressData } from "./NovelList";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

type SortField =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "title-desc"
  | "size-desc"
  | "size-asc"
  | "progress-desc"
  | "progress-asc";
type FileTypeFilter = "all" | "txt" | "epub";
type ReadingStatus = "all" | "reading" | "completed" | "not-started";

function getReadingStatus(
  novelId: string,
  progressData?: Record<string, NovelProgressData>,
): ReadingStatus {
  const progress = progressData?.[novelId];
  if (!progress || progress.totalVisited === 0) return "not-started";
  if (progress.totalChapters > 0 && progress.totalVisited >= progress.totalChapters)
    return "completed";
  return "reading";
}

function getProgressPercent(
  novelId: string,
  progressData?: Record<string, NovelProgressData>,
): number {
  const progress = progressData?.[novelId];
  if (!progress || progress.totalChapters === 0) return 0;
  return Math.round((progress.totalVisited / progress.totalChapters) * 100);
}

interface NovelLibraryProps {
  novels: Novel[];
  progressData?: Record<string, NovelProgressData>;
  bookmarkCounts?: Record<string, number>;
}

const STATUS_TABS: { value: ReadingStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
  { value: "not-started", label: "Not Started" },
];

export function NovelLibrary({ novels, progressData, bookmarkCounts }: NovelLibraryProps) {
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<FileTypeFilter>("all");
  const [sort, setSort] = useState<SortField>("date-desc");
  const [statusFilter, setStatusFilter] = useState<ReadingStatus>("all");

  // Count novels per status for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<ReadingStatus, number> = {
      all: novels.length,
      reading: 0,
      completed: 0,
      "not-started": 0,
    };
    for (const novel of novels) {
      const status = getReadingStatus(novel.id, progressData);
      counts[status]++;
    }
    return counts;
  }, [novels, progressData]);

  // Derive unique file types present in the collection
  const availableFileTypes = useMemo(() => {
    const types = new Set(novels.map((n) => n.fileType));
    return Array.from(types).sort();
  }, [novels]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    let result = novels;

    // Filter by reading status
    if (statusFilter !== "all") {
      result = result.filter(
        (n) => getReadingStatus(n.id, progressData) === statusFilter,
      );
    }

    // Filter by search query (title match)
    if (query) {
      result = result.filter((n) => n.title.toLowerCase().includes(query));
    }

    // Filter by file type
    if (fileType !== "all") {
      result = result.filter((n) => n.fileType === fileType);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "size-desc":
          return b.sizeBytes - a.sizeBytes;
        case "size-asc":
          return a.sizeBytes - b.sizeBytes;
        case "progress-desc":
          return getProgressPercent(b.id, progressData) - getProgressPercent(a.id, progressData);
        case "progress-asc":
          return getProgressPercent(a.id, progressData) - getProgressPercent(b.id, progressData);
        default:
          return 0;
      }
    });

    return result;
  }, [novels, search, fileType, sort, statusFilter, progressData]);

  const hasActiveFilters = search !== "" || fileType !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Reading status filter tabs */}
      <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Filter by reading status">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.value];
          const isActive = statusFilter === tab.value;
          // Hide tabs with 0 items (except "All" which always shows)
          if (tab.value !== "all" && count === 0) return null;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setStatusFilter(tab.value)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              {tab.label}
              {tab.value !== "all" && (
                <span
                  className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + filters + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <label htmlFor="novel-search" className="sr-only">Search novels by title</label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            id="novel-search"
            type="search"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filter + Sort controls */}
        <div className="flex items-center gap-2">
          {/* File type filter — only show if multiple types exist */}
          {availableFileTypes.length > 1 && (
            <Select value={fileType} onValueChange={(v) => setFileType(v as FileTypeFilter)}>
              <SelectTrigger size="sm" className="min-w-[90px]" aria-label="Filter by file type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {availableFileTypes.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {ft.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort control */}
          <Select value={sort} onValueChange={(v) => setSort(v as SortField)}>
            <SelectTrigger size="sm" className="min-w-[120px]" aria-label="Sort novels">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="date-asc">Oldest first</SelectItem>
              <SelectItem value="title-asc">Title A–Z</SelectItem>
              <SelectItem value="title-desc">Title Z–A</SelectItem>
              <SelectItem value="progress-desc">Most progress</SelectItem>
              <SelectItem value="progress-asc">Least progress</SelectItem>
              <SelectItem value="size-desc">Largest first</SelectItem>
              <SelectItem value="size-asc">Smallest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count when filtering */}
      {hasActiveFilters && (
        <div className="text-xs text-muted-foreground">
          <span role="status" aria-live="polite" aria-atomic="true" className="inline">
            {filtered.length === 0
              ? "No novels match your filters"
              : `Showing ${filtered.length} of ${novels.length} novel${novels.length !== 1 ? "s" : ""}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFileType("all");
                setStatusFilter("all");
              }}
              className="ml-2 text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Novel grid */}
      {filtered.length > 0 ? (
        <NovelList novels={filtered} progressData={progressData} bookmarkCounts={bookmarkCounts} />
      ) : !hasActiveFilters ? null : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground mb-1">No novels found</p>
          <p className="text-sm text-muted-foreground/70">
            Try a different search or clear your filters
          </p>
        </div>
      )}
    </div>
  );
}
