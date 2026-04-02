import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { previewGlossaryReplacement } from "@/app/lib/translation/find-replace";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId, entryId } = await context.params;
    const matches = await previewGlossaryReplacement({
      entryId,
      novelId,
      userId: session.user.id,
    });
    return NextResponse.json({ matches });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
