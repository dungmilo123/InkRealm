import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { cancelTranslationJob } from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const { translationId } = await context.params;

    const job = await cancelTranslationJob({
      translationId,
      userId: session.user.id,
    });

    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
