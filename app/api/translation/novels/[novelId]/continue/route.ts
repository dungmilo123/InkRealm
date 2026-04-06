import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  continueTranslation,
  runTranslationJob,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

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
    const { novelId } = await context.params;

    const job = await continueTranslation(novelId, session.user.id);

    // Run the translation in the background
    after(async () => {
      try {
        await runTranslationJob({
          translationId: job.id,
          allowFailedState: false,
          userId: session.user.id,
        });
      } catch (error) {
        console.error("Continue translation batch failed unexpectedly", {
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
