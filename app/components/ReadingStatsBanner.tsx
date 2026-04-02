import { BookOpen, BookCheck, BarChart3 } from "lucide-react";
import type { NovelProgressData } from "./NovelList";

interface ReadingStatsBannerProps {
  totalNovels: number;
  progressData: Record<string, NovelProgressData>;
}

export function ReadingStatsBanner({
  totalNovels,
  progressData,
}: ReadingStatsBannerProps) {
  const entries = Object.values(progressData);

  // No reading activity at all — don't render an empty banner
  if (entries.length === 0) return null;

  const novelsStarted = entries.length;
  const novelsCompleted = entries.filter(
    (p) => p.totalChapters > 0 && p.totalVisited >= p.totalChapters
  ).length;
  const totalChaptersRead = entries.reduce((sum, p) => sum + p.totalVisited, 0);
  const overallProgress =
    totalNovels > 0 ? Math.round((novelsStarted / totalNovels) * 100) : 0;

  const stats = [
    {
      icon: BookOpen,
      label: "Started",
      value: `${novelsStarted} of ${totalNovels}`,
    },
    {
      icon: BookCheck,
      label: "Finished",
      value: String(novelsCompleted),
    },
    {
      icon: BarChart3,
      label: "Chapters read",
      value: String(totalChaptersRead),
    },
  ];

  return (
    <div className="mb-5 rounded-lg border border-border bg-card/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Stats chips */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <stat.icon className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Overall library progress bar */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div
            className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Library exploration: ${overallProgress}%`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
            {overallProgress}% explored
          </span>
        </div>
      </div>
    </div>
  );
}
