import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { deleteNovel, NovelNotFoundError } from "@/app/lib/novels";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> }
) {
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
