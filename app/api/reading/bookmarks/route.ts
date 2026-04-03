import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  toggleBookmark,
  getBookmarksForNovel,
  updateBookmarkNote,
} from "@/app/lib/bookmarks";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

/**
 * POST /api/reading/bookmarks
 * Toggle a bookmark on a chapter. If the bookmark exists it is removed;
 * otherwise it is created.
 *
 * Body: { novelId: string, chapterIndex: number, note?: string }
 *
 * Response:
 *   201 — { bookmark: BookmarkData }  (created)
 *   200 — { removed: true }           (deleted)
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { novelId, chapterIndex, note } = body;

  if (
    typeof novelId !== "string" ||
    !novelId.trim() ||
    typeof chapterIndex !== "number" ||
    !Number.isInteger(chapterIndex) ||
    chapterIndex < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid parameters: requires novelId (non-empty string), chapterIndex (positive integer)",
      },
      { status: 400 }
    );
  }

  if (note !== undefined && note !== null && typeof note !== "string") {
    return NextResponse.json(
      { error: "note must be a string or null" },
      { status: 400 }
    );
  }

  if (typeof note === "string" && note.length > 500) {
    return NextResponse.json(
      { error: "note must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    const result = await toggleBookmark(
      session.user.id,
      novelId,
      chapterIndex,
      note as string | null | undefined
    );

    if (result === null) {
      return NextResponse.json({ removed: true });
    }

    return NextResponse.json(
      { bookmark: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to toggle bookmark:", error);
    return NextResponse.json(
      { error: "Failed to toggle bookmark" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reading/bookmarks?novelId=X
 * Returns all bookmarks for a novel, ordered by chapter index.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const novelId = url.searchParams.get("novelId");

  if (!novelId) {
    return NextResponse.json(
      { error: "Missing novelId query parameter" },
      { status: 400 }
    );
  }

  try {
    const bookmarks = await getBookmarksForNovel(session.user.id, novelId);
    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error("Failed to get bookmarks:", error);
    return NextResponse.json(
      { error: "Failed to get bookmarks" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reading/bookmarks
 * Update the note on an existing bookmark.
 *
 * Body: { bookmarkId: string, note: string | null }
 */
export async function PATCH(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bookmarkId, note } = body;

  if (typeof bookmarkId !== "string" || !bookmarkId.trim()) {
    return NextResponse.json(
      { error: "bookmarkId is required" },
      { status: 400 }
    );
  }

  if (note !== null && typeof note !== "string") {
    return NextResponse.json(
      { error: "note must be a string or null" },
      { status: 400 }
    );
  }

  if (typeof note === "string" && note.length > 500) {
    return NextResponse.json(
      { error: "note must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    const bookmark = await updateBookmarkNote(
      session.user.id,
      bookmarkId,
      note as string | null
    );
    return NextResponse.json({ bookmark });
  } catch (error) {
    if (error instanceof Error && error.message === "Bookmark not found") {
      return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }
    console.error("Failed to update bookmark:", error);
    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 }
    );
  }
}
