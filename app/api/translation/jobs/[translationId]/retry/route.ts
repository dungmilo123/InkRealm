import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { retryTranslationJob, runTranslationJobBatch } from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;
    const { translationId } = await context.params;

    const job = await retryTranslationJob({
      translationId,
      userId: session.user.id,
    });

    // Run the translation batch in the background so the UI gets the
    // retried job immediately and can start polling for progress.
    after(async () => {
      await runTranslationJobBatch({
        translationId: job.id,
        allowFailedState: true,
        userId: session.user.id,
      });
    });

    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
