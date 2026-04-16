import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  continueTranslation,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { enqueueTranslationJob } from "@/app/lib/queue/translation";
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

    await enqueueTranslationJob({
      translationId: job.id,
      userId: session.user.id,
      allowFailedState: false,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
