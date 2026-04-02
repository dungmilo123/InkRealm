"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Props for the shared {@link ErrorBoundaryPage} component.
 *
 * Each route-level `error.tsx` passes its Next.js `error`/`reset` props
 * along with contextual copy (title, description) and a navigation link.
 */
export type ErrorBoundaryPageProps = {
  /** The error object provided by Next.js error boundaries. */
  error: Error & { digest?: string };
  /** Callback to re-render the segment that threw. */
  reset: () => void;
  /** Heading shown to the user, e.g. "Couldn't load your library". */
  title: string;
  /** Brief explanation of what went wrong and what to do. */
  description: string;
  /** Label for the secondary navigation link (e.g. "Back to library"). */
  backLabel: string;
  /** Destination for the secondary navigation link. */
  backHref: string;
  /** Prefix used when logging to console, e.g. "DashboardError". */
  logLabel?: string;
};

/**
 * Shared error page layout used by all route-level `error.tsx` boundaries.
 *
 * Renders a centered card with a warning icon, contextual messaging, an
 * error digest (when available), a retry button, and a navigation link.
 * Error boundaries should remain thin wrappers that supply only the
 * route-specific props.
 */
export default function ErrorBoundaryPage({
  error,
  reset,
  title,
  description,
  backLabel,
  backHref,
  logLabel = "ErrorBoundary",
}: ErrorBoundaryPageProps) {
  useEffect(() => {
    console.error(`[${logLabel}]`, error);
  }, [error, logLabel]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-destructive"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-6 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
