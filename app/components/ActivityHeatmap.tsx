"use client";

import { useMemo } from "react";
import type { DailyActivity } from "@/lib/reading-stats";

// ─── Configuration ──────────────────────────────────────────────────

const WEEKS_TO_SHOW = 20; // ~5 months of history (compact for a dashboard widget)
const CELL_SIZE = 12; // px per cell
const CELL_GAP = 2; // px gap between cells
const CELL_RADIUS = 2; // rounded corners
const DAY_LABEL_WIDTH = 28; // space for Mon/Wed/Fri labels

/** Intensity levels: 0 = no activity, 1-4 = quartile-based */
type IntensityLevel = 0 | 1 | 2 | 3 | 4;

// CSS classes for intensity levels — uses Tailwind-compatible inline styles
// since CSS custom properties from the theme aren't accessible in SVG fill easily.
// We use the InkRealm amber/warm palette to match the bookmark badge aesthetic.
const INTENSITY_COLORS: Record<IntensityLevel, string> = {
  0: "var(--color-muted)", // empty cell
  1: "oklch(0.65 0.12 75)", // light warm
  2: "oklch(0.58 0.15 65)", // medium warm
  3: "oklch(0.50 0.18 55)", // strong warm
  4: "oklch(0.42 0.20 45)", // intense warm
};

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for a Date in UTC. */
function toDateKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the day-of-week (0=Sun, 1=Mon, ..., 6=Sat) for a YYYY-MM-DD key. */
function getDayOfWeek(dateKey: string): number {
  return new Date(dateKey + "T00:00:00Z").getUTCDay();
}

/**
 * Computes intensity quartiles from activity data.
 * Returns thresholds for levels 1-4 based on non-zero chapter counts.
 */
function computeThresholds(activities: DailyActivity[]): number[] {
  const counts = activities
    .map((a) => a.chaptersRead)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);

  if (counts.length === 0) return [1, 2, 3, 4];

  const max = counts[counts.length - 1];
  if (max <= 4) return [1, 2, 3, 4];

  // Quartile-based thresholds
  const q1 = counts[Math.floor(counts.length * 0.25)] ?? 1;
  const q2 = counts[Math.floor(counts.length * 0.5)] ?? q1 + 1;
  const q3 = counts[Math.floor(counts.length * 0.75)] ?? q2 + 1;

  // Ensure strictly increasing thresholds
  return [
    Math.max(1, q1),
    Math.max(q1 + 1, q2),
    Math.max(q2 + 1, q3),
    Math.max(q3 + 1, max),
  ];
}

function getIntensity(
  chapters: number,
  thresholds: number[]
): IntensityLevel {
  if (chapters === 0) return 0;
  if (chapters <= thresholds[0]) return 1;
  if (chapters <= thresholds[1]) return 2;
  if (chapters <= thresholds[2]) return 3;
  return 4;
}

/** Builds the grid of cells: an array of weeks, each containing up to 7 days. */
function buildGrid(
  activityMap: Map<string, DailyActivity>,
  thresholds: number[],
  today: Date
): GridCell[][] {
  const weeks: GridCell[][] = [];

  // Find the start date: go back WEEKS_TO_SHOW weeks from the start of the current week
  const todayKey = toDateKey(today);
  const todayDow = getDayOfWeek(todayKey);

  // Start of the current week (Sunday)
  const startOfCurrentWeek = new Date(today);
  startOfCurrentWeek.setUTCDate(startOfCurrentWeek.getUTCDate() - todayDow);

  // Go back WEEKS_TO_SHOW - 1 more weeks
  const gridStart = new Date(startOfCurrentWeek);
  gridStart.setUTCDate(gridStart.getUTCDate() - (WEEKS_TO_SHOW - 1) * 7);

  const cursor = new Date(gridStart);
  let currentWeek: GridCell[] = [];

  while (true) {
    const dateKey = toDateKey(cursor);

    // Stop after today
    if (dateKey > todayKey) break;

    const dow = getDayOfWeek(dateKey);
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    const activity = activityMap.get(dateKey);
    const chapters = activity?.chaptersRead ?? 0;
    const minutes = activity?.estimatedMinutes ?? 0;

    currentWeek.push({
      dateKey,
      dayOfWeek: dow,
      chapters,
      minutes,
      intensity: getIntensity(chapters, thresholds),
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Push the final partial week
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

type GridCell = {
  dateKey: string;
  dayOfWeek: number;
  chapters: number;
  minutes: number;
  intensity: IntensityLevel;
};

// ─── Month labels ───────────────────────────────────────────────────

function getMonthLabels(weeks: GridCell[][]): { label: string; x: number }[] {
  const labels: { label: string; x: number }[] = [];
  let lastMonth = "";

  for (let w = 0; w < weeks.length; w++) {
    // Use the first day of the week to determine the month
    const firstDay = weeks[w][0];
    if (!firstDay) continue;
    const month = firstDay.dateKey.substring(0, 7); // YYYY-MM
    if (month !== lastMonth) {
      const monthName = new Date(firstDay.dateKey + "T00:00:00Z").toLocaleString(
        "en-US",
        { month: "short", timeZone: "UTC" }
      );
      labels.push({
        label: monthName,
        x: DAY_LABEL_WIDTH + w * (CELL_SIZE + CELL_GAP),
      });
      lastMonth = month;
    }
  }

  return labels;
}

// ─── Tooltip formatting ─────────────────────────────────────────────

function formatTooltip(cell: GridCell): string {
  const date = new Date(cell.dateKey + "T00:00:00Z");
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (cell.chapters === 0) {
    return `${dateStr}: No reading activity`;
  }

  const chLabel = cell.chapters === 1 ? "chapter" : "chapters";
  return `${dateStr}: ${cell.chapters} ${chLabel} (~${cell.minutes} min)`;
}

// ─── Component ──────────────────────────────────────────────────────

interface ActivityHeatmapProps {
  /** Daily activity data from computeDailyActivity() */
  dailyActivity: DailyActivity[];
}

export function ActivityHeatmap({ dailyActivity }: ActivityHeatmapProps) {
  const { weeks, monthLabels, thresholds } = useMemo(() => {
    const activityMap = new Map<string, DailyActivity>();
    for (const a of dailyActivity) {
      activityMap.set(a.date, a);
    }

    const t = computeThresholds(dailyActivity);
    const today = new Date();
    const w = buildGrid(activityMap, t, today);
    const ml = getMonthLabels(w);

    return { weeks: w, monthLabels: ml, thresholds: t };
  }, [dailyActivity]);

  if (dailyActivity.length === 0) {
    return null; // Don't render an empty heatmap
  }

  const MONTH_LABEL_HEIGHT = 16;
  const svgWidth =
    DAY_LABEL_WIDTH + weeks.length * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const svgHeight =
    MONTH_LABEL_HEIGHT + 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP;

  // Summary stats for the visible period
  const totalChapters = dailyActivity.reduce((s, a) => s + a.chaptersRead, 0);
  const activeDays = dailyActivity.filter((a) => a.chaptersRead > 0).length;

  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3 mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Reading Activity
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {totalChapters} chapters across {activeDays} active{" "}
          {activeDays === 1 ? "day" : "days"}
        </span>
      </div>

      {/* Horizontally scrollable container for small screens */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          role="img"
          aria-label={`Reading activity heatmap showing ${totalChapters} chapters read across ${activeDays} days`}
        >
          {/* Month labels */}
          {monthLabels.map((ml) => (
            <text
              key={`month-${ml.label}-${ml.x}`}
              x={ml.x}
              y={MONTH_LABEL_HEIGHT - 4}
              className="fill-muted-foreground"
              fontSize="10"
              fontFamily="inherit"
            >
              {ml.label}
            </text>
          ))}

          {/* Day labels (Mon, Wed, Fri) */}
          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={`day-${label}`}
                x={0}
                y={
                  MONTH_LABEL_HEIGHT +
                  i * (CELL_SIZE + CELL_GAP) +
                  CELL_SIZE * 0.75
                }
                className="fill-muted-foreground"
                fontSize="9"
                fontFamily="inherit"
              >
                {label}
              </text>
            ) : null
          )}

          {/* Activity cells */}
          {weeks.map((week, wIdx) =>
            week.map((cell) => (
              <rect
                key={cell.dateKey}
                x={DAY_LABEL_WIDTH + wIdx * (CELL_SIZE + CELL_GAP)}
                y={
                  MONTH_LABEL_HEIGHT +
                  cell.dayOfWeek * (CELL_SIZE + CELL_GAP)
                }
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_RADIUS}
                ry={CELL_RADIUS}
                fill={INTENSITY_COLORS[cell.intensity]}
                className={
                  cell.intensity === 0 ? "opacity-40" : "opacity-100"
                }
              >
                <title>{formatTooltip(cell)}</title>
              </rect>
            ))
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[10px] text-muted-foreground mr-1">Less</span>
        {([0, 1, 2, 3, 4] as IntensityLevel[]).map((level) => (
          <div
            key={level}
            className="rounded-sm"
            style={{
              width: 10,
              height: 10,
              backgroundColor: INTENSITY_COLORS[level],
              opacity: level === 0 ? 0.4 : 1,
            }}
            title={
              level === 0
                ? "No activity"
                : `≤ ${thresholds[level - 1]} chapter${thresholds[level - 1] === 1 ? "" : "s"}`
            }
          />
        ))}
        <span className="text-[10px] text-muted-foreground ml-1">More</span>
      </div>
    </div>
  );
}
