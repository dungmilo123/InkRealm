import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTranslationProfile, listTranslationProfilesForDisplay } from "@/app/lib/translation/profiles";
import {
  handleTranslationRouteError,
  safeReadJson,
} from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profiles = await listTranslationProfilesForDisplay(session.user.id);
    return NextResponse.json({ profiles });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await safeReadJson(request);
    const profile = await createTranslationProfile(payload, session.user.id);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
