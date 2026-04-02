import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import {
  deleteTranslationProfile,
  updateTranslationProfile,
} from "@/app/lib/translation/profiles";
import {
  handleTranslationRouteError,
  safeReadJson,
} from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function DELETE(
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
    await deleteTranslationProfile(profileId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;
    const payload = await safeReadJson(request);
    const { profileId } = await context.params;
    const profile = await updateTranslationProfile(profileId, payload, session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
