import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  createTranslationJobFromNovelDetails,
  getLatestNovelTranslationJobView,
  runTranslationJob,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { parseStartTranslationPayload } from "@/app/lib/translation/validation";
import { apiLimiter, apiFrequentLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiFrequentLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;
    const { novelId } = await context.params;
    const job = await getLatestNovelTranslationJobView(novelId, session.user.id);
    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;
    const payload = await safeReadJson(request);
    const { novelId } = await context.params;
    const parsed = parseStartTranslationPayload(payload);

    const job = await createTranslationJobFromNovelDetails({
      novelId,
      profileId: parsed.profileId,
      chapterFrom: parsed.chapterFrom,
      chapterTo: parsed.chapterTo,
      userId: session.user.id,
    });

    // Run the translation in the background so the UI gets the
    // created job immediately and can start polling for progress.
    after(async () => {
      try {
        await runTranslationJob({
          translationId: job.id,
          allowFailedState: false,
          userId: session.user.id,
        });
      } catch (error) {
        console.error("Translation batch failed unexpectedly", {
          translationId: job.id,
          error,
        });
      }
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
