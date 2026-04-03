import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { getNovelById, NovelNotFoundError } from "@/app/lib/novels";
import { getReaderDocument } from "@/app/lib/reader/service";
import { ReaderUnavailableError } from "@/app/lib/reader/types";
import { searchNovel } from "@/lib/novel-search";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

/**
 * GET /api/novels/[novelId]/search?q=<query>&maxPerChapter=<N>
 *
 * Searches across all chapters of a novel for the given query string.
 * Returns matches grouped by chapter with context snippets.
 *
 * Query params:
 *   q              — search query (required, min 2 chars)
 *   maxPerChapter  — max snippet matches per chapter (optional, default 3, max 10)
 *
 * Response:
 *   200 — { results: NovelSearchResult }
 *   400 — invalid params
 *   404 — novel not found or not owned by user
 *   422 — novel file cannot be parsed
 *   500 — server error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ novelId: string }> }
) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  const { novelId } = await params;
  if (!novelId || typeof novelId !== "string") {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  // Parse and validate query params
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search query (q) is required and must be at least 2 characters" },
      { status: 400 }
    );
  }

  let maxPerChapter = 3;
  const maxPerChapterParam = url.searchParams.get("maxPerChapter");
  if (maxPerChapterParam !== null) {
    const parsed = parseInt(maxPerChapterParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      return NextResponse.json(
        { error: "maxPerChapter must be an integer between 1 and 10" },
        { status: 400 }
      );
    }
    maxPerChapter = parsed;
  }

  try {
    // Fetch novel and verify ownership
    const novel = await getNovelById(novelId);
    if (!novel || novel.userId !== session.user.id) {
      return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    }

    // Parse the novel file (LRU-cached by novelId + updatedAt)
    const document = await getReaderDocument(novel);

    // Search across all chapters
    const results = searchNovel(document.chapters, query.trim(), {
      maxMatchesPerChapter: maxPerChapter,
    });

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof NovelNotFoundError) {
      return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    }
    if (error instanceof ReaderUnavailableError) {
      return NextResponse.json(
        { error: "This novel cannot be searched: " + error.message },
        { status: 422 }
      );
    }
    console.error("Failed to search novel:", { novelId, error });
    return NextResponse.json(
      { error: "Failed to search novel" },
      { status: 500 }
    );
  }
}
