import { NextResponse } from "next/server";
import { runTranslationJobBatch } from "@/app/lib/translation/service";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { parseRunTranslationPayload } from "@/app/lib/translation/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const payload = await safeReadJson(request);
    const parsed = parseRunTranslationPayload(payload);
    const { translationId } = await context.params;

    const job = await runTranslationJobBatch({
      translationId,
      batchSize: parsed.batchSize,
      profileId: parsed.profileId,
    });

    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
