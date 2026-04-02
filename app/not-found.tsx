import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
};

/**
 * Global 404 page for any unmatched route.
 *
 * Shown when a user navigates to a URL that doesn't correspond to
 * any page in the app. The novel-specific not-found.tsx handles
 * novel/chapter 404s with a more contextual message; this one is
 * the catch-all fallback.
 */
export default function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
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
            className="text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Check the URL, or head back to your library.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-6 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}
