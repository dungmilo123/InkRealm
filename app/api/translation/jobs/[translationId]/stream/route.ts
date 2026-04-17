import {
  createTranslationEventStream,
  TRANSLATION_SSE_HEADERS,
} from "@/app/lib/translation/sse";
import { requireAuth } from "@/app/lib/require-auth";
import { getTranslationJobStatus } from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import {
  getClientIp,
  rateLimitResponse,
  translationStreamLimiter,
} from "@/app/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const limiterResult = translationStreamLimiter.check(ip);
    if (!limiterResult.allowed) {
      return rateLimitResponse(limiterResult);
    }

    const { session, response } = await requireAuth();
    if (response) {
      return response;
    }

    const { translationId } = await context.params;
    const snapshot = await getTranslationJobStatus(translationId, session.user.id);

    const stream = createTranslationEventStream({
      translationId,
      snapshot,
      signal: request.signal,
    });

    return new Response(stream, {
      headers: TRANSLATION_SSE_HEADERS,
    });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
