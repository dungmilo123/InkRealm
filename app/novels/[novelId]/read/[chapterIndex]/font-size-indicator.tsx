"use client";

import { useEffect, useRef, useState } from "react";

type FontSizeIndicatorProps = {
  /** Current font size in pixels */
  fontSize: number;
  /** Min allowed font size */
  min: number;
  /** Max allowed font size */
  max: number;
};

/**
 * Transient indicator that appears briefly when font size changes
 * via keyboard shortcut, then fades out after 1.5 seconds.
 * Always mounted; visibility controlled by CSS transitions.
 */
export function FontSizeIndicator({
  fontSize,
  min,
  max,
}: FontSizeIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip showing indicator on initial mount — only react to changes
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    queueMicrotask(() => setVisible(true));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fontSize]);

  // Percentage within the allowed range for the bar fill
  const percent = Math.round(((fontSize - min) / (max - min)) * 100);

  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-[90] transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-4 py-2.5 shadow-lg">
        <span
          className="text-muted-foreground select-none"
          style={{ fontSize: "11px" }}
          aria-hidden="true"
        >
          A
        </span>
        <div className="flex flex-col gap-1 min-w-[100px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground tabular-nums">
              {fontSize}px
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span
          className="text-foreground font-medium select-none"
          style={{ fontSize: "16px" }}
          aria-hidden="true"
        >
          A
        </span>
      </div>
    </div>
  );
}
