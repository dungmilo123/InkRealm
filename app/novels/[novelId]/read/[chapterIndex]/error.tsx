"use client";

import { useParams } from "next/navigation";
import ErrorBoundaryPage from "@/app/components/error-boundary-page";

/**
 * Error boundary for the chapter reader route.
 *
 * Catches failures from chapter data loading, preference
 * fetching, or translation retrieval. Offers navigation
 * back to the novel's detail page.
 */
export default function ReaderChapterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ novelId: string }>();

  return (
    <ErrorBoundaryPage
      error={error}
      reset={reset}
      title="Couldn't load this chapter"
      description="We had trouble loading the chapter content. The novel file may be temporarily unavailable."
      backLabel="Back to novel"
      backHref={params.novelId ? `/novels/${encodeURIComponent(params.novelId)}` : "/dashboard"}
      logLabel="ReaderChapterError"
    />
  );
}
