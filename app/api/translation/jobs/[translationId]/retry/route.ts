import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { retryTranslationJob } from "@/app/lib/translation/service";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { parseRunTranslationPayload } from "@/app/lib/translation/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await safeReadJson(request);
    const parsed = parseRunTranslationPayload(payload);
    const { translationId } = await context.params;

    const job = await retryTranslationJob({
      translationId,
      batchSize: parsed.batchSize,
      profileId: parsed.profileId,
      userId: session.user.id,
    });

    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
