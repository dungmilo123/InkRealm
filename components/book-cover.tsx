"use client";

import { useState, useEffect } from "react";

interface BookCoverProps {
  title: string;
  id: string;
  fileType: string;
  className?: string;
  width?: number;
  height?: number;
}

const PALETTE_FAMILIES = [
  { bg: "oklch(0.45 0.12 25)", accent: "oklch(0.7 0.1 50)", text: "oklch(0.95 0.02 90)" },
  { bg: "oklch(0.4 0.1 180)", accent: "oklch(0.6 0.08 200)", text: "oklch(0.95 0.01 180)" },
  { bg: "oklch(0.5 0.1 130)", accent: "oklch(0.65 0.08 140)", text: "oklch(0.97 0.01 130)" },
  { bg: "oklch(0.42 0.08 280)", accent: "oklch(0.6 0.1 300)", text: "oklch(0.97 0.01 280)" },
  { bg: "oklch(0.52 0.1 70)", accent: "oklch(0.7 0.08 80)", text: "oklch(0.25 0.02 70)" },
  { bg: "oklch(0.48 0.12 350)", accent: "oklch(0.65 0.1 20)", text: "oklch(0.97 0.02 350)" },
  { bg: "oklch(0.38 0.08 90)", accent: "oklch(0.55 0.08 100)", text: "oklch(0.97 0.01 90)" },
  { bg: "oklch(0.55 0.06 240)", accent: "oklch(0.7 0.06 250)", text: "oklch(0.97 0.01 240)" },
];

const DECORATIVE_LAYOUTS = [
  "flex flex-col justify-between p-4",
  "flex flex-col justify-center p-4 gap-3",
  "flex flex-col justify-end p-4 gap-2",
  "flex flex-col justify-center p-5",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getWords(title: string): string[] {
  return title.split(/\s+/).filter(w => w.length > 0);
}

function getInitials(title: string): string {
  const words = getWords(title);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  const words = getWords(title);
  let result = "";
  for (const word of words) {
    if ((result + " " + word).trim().length > maxLen - 3) {
      break;
    }
    result = (result + " " + word).trim();
  }
  return result + "...";
}

function GeneratedCover({
  title,
  id,
  fileType,
  className = "",
  width = 120,
  height = 180,
}: BookCoverProps) {
  const hash = hashString(id + title);
  const palette = PALETTE_FAMILIES[hash % PALETTE_FAMILIES.length];
  const layout = DECORATIVE_LAYOUTS[(hash >> 3) % DECORATIVE_LAYOUTS.length];
  const initials = getInitials(title);
  const displayTitle = truncateTitle(title, Math.floor(width * 0.4));
  const typeLabel = fileType.toUpperCase();

  const spineWidth = Math.floor(width * 0.06) + (hash % 6);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <div
        className="absolute inset-0 rounded-md overflow-hidden"
        style={{ backgroundColor: palette.bg }}
      >
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{
            width: `${spineWidth}px`,
            backgroundColor: palette.accent,
          }}
        />

        <div
          className="absolute right-0 top-0 bottom-0"
          style={{
            width: '3px',
            background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.15))',
          }}
        />

        <div className={layout} style={{ marginLeft: `${spineWidth + 6}px` }}>
          <div
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: palette.accent }}
          >
            {typeLabel}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div
              className="text-2xl font-heading font-bold text-center leading-tight"
              style={{ color: palette.text }}
            >
              {initials}
            </div>
          </div>

          <div
            className="text-[10px] font-sans leading-snug font-medium text-center"
            style={{ color: palette.text, opacity: 0.85 }}
          >
            {displayTitle}
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-2"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.1), transparent)' }}
        />
      </div>
    </div>
  );
}

export function BookCover({ title, id, fileType, className = "", width = 120, height = 180 }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    if (fileType !== "epub") return;

    let objectUrl: string | null = null;
    let cancelled = false;

    async function fetchCover() {
      try {
        const res = await fetch(`/api/novels/${id}/cover`);
        if (!res.ok) {
          if (!cancelled) setCoverError(true);
          return;
        }
        const blob = await res.blob();
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setCoverUrl(objectUrl);
        }
      } catch {
        if (!cancelled) setCoverError(true);
      }
    }

    fetchCover();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, fileType]);

  // Show real cover image when successfully fetched
  if (coverUrl) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={title}
          className="rounded-md object-cover w-full h-full"
          style={{ width, height, objectFit: "cover" }}
        />
      </div>
    );
  }

  // Render generated cover as placeholder (loading) or fallback (error / non-epub)
  return (
    <GeneratedCover
      title={title}
      id={id}
      fileType={fileType}
      className={className}
      width={width}
      height={height}
    />
  );
}
