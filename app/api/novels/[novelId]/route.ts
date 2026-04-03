import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { deleteNovel, toggleNovelPin, NovelNotFoundError } from "@/app/lib/novels";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

/**
 * PATCH /api/novels/[novelId]
 * Toggle the pinned state of a novel.
 *
 * Body: { action: "togglePin" }
 *
 * Response:
 *   200 — { isPinned: boolean }
 */
export async function PATCH(
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "togglePin") {
    return NextResponse.json(
      { error: "Invalid action. Supported: togglePin" },
      { status: 400 }
    );
  }

  try {
    const result = await toggleNovelPin(novelId, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NovelNotFoundError) {
      return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    }
    console.error("Failed to toggle pin", { novelId, error: err });
    return NextResponse.json(
      { error: "Failed to toggle pin" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  try {
    await deleteNovel(novelId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NovelNotFoundError) {
      return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    }
    console.error("Failed to delete novel", { novelId, error: err });
    return NextResponse.json(
      { error: "Failed to delete novel" },
      { status: 500 }
    );
  }
}
