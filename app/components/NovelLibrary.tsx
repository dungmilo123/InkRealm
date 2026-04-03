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

type SortField = "date-desc" | "date-asc" | "title-asc" | "title-desc" | "size-desc" | "size-asc";
type FileTypeFilter = "all" | "txt" | "epub";

interface NovelLibraryProps {
  novels: Novel[];
  progressData?: Record<string, NovelProgressData>;
  bookmarkCounts?: Record<string, number>;
}

export function NovelLibrary({ novels, progressData, bookmarkCounts }: NovelLibraryProps) {
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<FileTypeFilter>("all");
  const [sort, setSort] = useState<SortField>("date-desc");

  // Derive unique file types present in the collection
  const availableFileTypes = useMemo(() => {
    const types = new Set(novels.map((n) => n.fileType));
    return Array.from(types).sort();
  }, [novels]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    let result = novels;

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
        default:
          return 0;
      }
    });

    return result;
  }, [novels, search, fileType, sort]);

  const hasActiveFilters = search !== "" || fileType !== "all";

  return (
    <div className="space-y-4">
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
