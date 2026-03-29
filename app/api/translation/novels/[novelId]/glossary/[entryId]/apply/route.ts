import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { applyGlossaryReplacement } from "@/app/lib/translation/find-replace";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId, entryId } = await context.params;
    const result = await applyGlossaryReplacement({
      entryId,
      novelId,
      userId: session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
