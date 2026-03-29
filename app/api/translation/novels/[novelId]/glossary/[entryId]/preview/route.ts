import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { previewGlossaryReplacement } from "@/app/lib/translation/find-replace";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId, entryId } = await context.params;
    const matches = await previewGlossaryReplacement({
      entryId,
      novelId,
      userId: session.user.id,
    });
    return NextResponse.json({ matches });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
