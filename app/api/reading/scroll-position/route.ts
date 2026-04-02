import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  saveScrollPosition,
  getScrollPosition,
} from "@/app/lib/reading-progress";
import { apiFrequentLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

/**
 * PUT /api/reading/scroll-position
 * Saves the reader's scroll position for a specific chapter.
 *
 * Body: { novelId: string, chapterIndex: number, scrollPosition: number }
 * scrollPosition is a 0–1 ratio representing how far through the chapter.
 */
export async function PUT(request: Request) {
  const ip = getClientIp(request);
  const rl = apiFrequentLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { novelId, chapterIndex, scrollPosition } = body;

  if (
    typeof novelId !== "string" ||
    typeof chapterIndex !== "number" ||
    !Number.isInteger(chapterIndex) ||
    chapterIndex < 1 ||
    typeof scrollPosition !== "number" ||
    !Number.isFinite(scrollPosition)
  ) {
    return NextResponse.json(
      { error: "Invalid parameters: requires novelId (string), chapterIndex (int >= 1), scrollPosition (number 0-1)" },
      { status: 400 }
    );
  }

  try {
    await saveScrollPosition(
      session.user.id,
      novelId,
      chapterIndex,
      scrollPosition
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save scroll position:", error);
    return NextResponse.json(
      { error: "Failed to save scroll position" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reading/scroll-position?novelId=X&chapterIndex=Y
 * Returns the saved scroll position for a specific chapter.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = apiFrequentLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const novelId = url.searchParams.get("novelId");
  const chapterIndexStr = url.searchParams.get("chapterIndex");

  if (!novelId || !chapterIndexStr) {
    return NextResponse.json(
      { error: "Missing novelId or chapterIndex query parameter" },
      { status: 400 }
    );
  }

  const chapterIndex = Number(chapterIndexStr);
  if (!Number.isInteger(chapterIndex) || chapterIndex < 1) {
    return NextResponse.json(
      { error: "chapterIndex must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const scrollPosition = await getScrollPosition(
      session.user.id,
      novelId,
      chapterIndex
    );
    return NextResponse.json({ scrollPosition });
  } catch (error) {
    console.error("Failed to get scroll position:", error);
    return NextResponse.json(
      { error: "Failed to get scroll position" },
      { status: 500 }
    );
  }
}
