import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { profileId } = await context.params;
    const profile = await setDefaultProfile(profileId, session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
