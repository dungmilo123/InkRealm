import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteNovel, NovelNotFoundError } from "@/app/lib/novels";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
