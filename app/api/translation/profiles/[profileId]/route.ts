import { NextResponse } from "next/server";
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
    const payload = await safeReadJson(request);
    const { profileId } = await context.params;
    const profile = await updateTranslationProfile(profileId, payload);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
