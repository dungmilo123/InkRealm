import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateTranslationProfile } from "@/app/lib/translation/profiles";
import {
  handleTranslationRouteError,
  safeReadJson,
} from "@/app/lib/translation/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await safeReadJson(request);
    const { profileId } = await context.params;
    const profile = await updateTranslationProfile(profileId, payload, session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
