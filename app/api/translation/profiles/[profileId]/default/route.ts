import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { setDefaultProfile } from "@/app/lib/translation/profiles";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function PUT(
  request: Request,
  context: { params: Promise<{ profileId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;
    const { profileId } = await context.params;
    const profile = await setDefaultProfile(profileId, session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
