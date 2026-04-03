"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReadingVelocity, VelocityTrend } from "@/lib/reading-velocity";

// ─── Configuration ──────────────────────────────────────────────────

const BAR_MAX_HEIGHT = 64; // px — tallest bar height
const BAR_MIN_HEIGHT = 3; // px — minimum visible bar (for weeks with activity > 0)

// Bar color: uses the same warm palette as ActivityHeatmap
const BAR_COLOR = "oklch(0.58 0.15 65)"; // medium warm (matches heatmap level 2)
const BAR_COLOR_CURRENT = "oklch(0.50 0.18 55)"; // stronger warm for current week
const BAR_COLOR_EMPTY = "var(--color-muted)";

// ─── Trend icon helper ──────────────────────────────────────────────

function TrendIndicator({ trend }: { trend: VelocityTrend }) {
  const Icon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus;

  const colorClass =
    trend.direction === "up"
      ? "text-emerald-500"
      : trend.direction === "down"
        ? "text-orange-400"
        : "text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${colorClass}`}>
      <Icon className="size-3" aria-hidden="true" />
      <span className="tabular-nums">{trend.label}</span>
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────

interface WeeklyVelocityChartProps {
  /** Pre-computed velocity data from computeReadingVelocity(). */
  velocity: ReadingVelocity;
}

export function WeeklyVelocityChart({ velocity }: WeeklyVelocityChartProps) {
  const { weeks, maxChapters, avgChaptersPerWeek, trend, totalChapters } =
    velocity;

  // Compute bar heights relative to maxChapters
  const bars = useMemo(() => {
    if (maxChapters === 0) return weeks.map((w) => ({ ...w, height: 0 }));

    return weeks.map((w) => ({
      ...w,
      height:
        w.chaptersRead === 0
          ? 0
          : Math.max(
              BAR_MIN_HEIGHT,
              Math.round((w.chaptersRead / maxChapters) * BAR_MAX_HEIGHT)
            ),
    }));
  }, [weeks, maxChapters]);

  // Don't render if there's no meaningful data
  if (weeks.length === 0 || totalChapters === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3 mb-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Weekly Pace
        </h3>
        <div className="flex items-center gap-3">
          {avgChaptersPerWeek > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              avg {avgChaptersPerWeek} ch/wk
            </span>
          )}
          <TrendIndicator trend={trend} />
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-[3px]" style={{ height: BAR_MAX_HEIGHT + 4 }}>
        {bars.map((bar) => (
          <div
            key={bar.weekStart}
            className="flex-1 relative group"
            style={{ height: "100%" }}
          >
            {/* Bar */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-200"
              style={{
                height: bar.height,
                backgroundColor:
                  bar.chaptersRead === 0
                    ? BAR_COLOR_EMPTY
                    : bar.isCurrentWeek
                      ? BAR_COLOR_CURRENT
                      : BAR_COLOR,
                opacity: bar.chaptersRead === 0 ? 0.3 : 1,
              }}
            />
            {/* Tooltip via title attribute */}
            <div
              className="absolute inset-0"
              title={
                bar.isCurrentWeek
                  ? `${bar.label} (this week): ${bar.chaptersRead} ch, ~${bar.estimatedMinutes} min`
                  : `Week of ${bar.label}: ${bar.chaptersRead} ch, ~${bar.estimatedMinutes} min`
              }
            />
          </div>
        ))}
      </div>

      {/* X-axis labels — show first, middle, and last week labels */}
      <div className="flex justify-between mt-1.5">
        {bars.length > 0 && (
          <>
            <span className="text-[9px] text-muted-foreground/70">
              {bars[0].label}
            </span>
            {bars.length > 4 && (
              <span className="text-[9px] text-muted-foreground/70">
                {bars[Math.floor(bars.length / 2)].label}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/70">
              {bars[bars.length - 1].isCurrentWeek
                ? "This wk"
                : bars[bars.length - 1].label}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
