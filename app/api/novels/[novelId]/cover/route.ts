import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { getNovelByIdOrNotFound } from "@/app/lib/novels";
import { readNovelFile } from "@/app/lib/storage";
import { extractEpubCover } from "@/app/lib/reader/epub";

/**
 * GET /api/novels/[novelId]/cover
 *
 * Returns the cover image for an EPUB novel.
 * Authenticated — returns 401 if not signed in.
 * Returns 404 if the novel doesn't exist, belongs to another user,
 * is not an EPUB, or has no detectable cover image.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { novelId } = await params;

  const novel = await getNovelByIdOrNotFound(novelId, session.user.id);

  if (novel.fileType !== "epub") {
    return NextResponse.json({ error: "No cover available" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readNovelFile(novel.storagePath);
  } catch (err) {
    console.error("Failed to read novel file for cover extraction", {
      novelId,
      storagePath: novel.storagePath,
      error: err,
    });
    return NextResponse.json({ error: "Failed to read novel file" }, { status: 500 });
  }

  const cover = extractEpubCover(buffer);
  if (!cover) {
    return NextResponse.json({ error: "No cover available" }, { status: 404 });
  }

  return new Response(cover.data as unknown as BodyInit, {
    headers: {
      "Content-Type": cover.mediaType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
