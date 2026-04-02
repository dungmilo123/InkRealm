import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { getTranslationJobStatus } from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const { translationId } = await context.params;

    const result = await getTranslationJobStatus(translationId, session.user.id);

    return NextResponse.json({ job: result.job, chapterStatuses: result.chapterStatuses });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
