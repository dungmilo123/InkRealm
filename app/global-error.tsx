"use client";

/**
 * Root-level error boundary for the entire application.
 *
 * This catches errors that occur in the root layout itself —
 * the only scenario where app/error.tsx cannot catch them.
 * Because it replaces the root layout, it must render its own
 * <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex items-center justify-center bg-[#1a1814] text-[#e8e0d4] font-sans antialiased">
        <div className="w-full max-w-lg rounded-lg border border-[#3d362e] bg-[#252118] p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#3d362e]">
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
              className="text-[#e8e0d4]"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-[#a09888]">
            An unexpected error occurred. You can try again, or return to the
            home page if the problem persists.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-[#706858]">
              Error ID: {error.digest}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex h-10 items-center rounded-full bg-[#e8e0d4] text-[#1a1814] px-6 text-sm font-medium hover:bg-[#d8d0c4] transition-colors"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-full border border-[#3d362e] px-6 text-sm font-medium hover:bg-[#3d362e]/50 transition-colors"
            >
              Back to library
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
