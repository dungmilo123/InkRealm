import { NextResponse } from "next/server";
import { createTranslationProfile, listTranslationProfilesForDisplay } from "@/app/lib/translation/profiles";
import {
  handleTranslationRouteError,
  safeReadJson,
} from "@/app/lib/translation/http";

export async function GET() {
  try {
    const profiles = await listTranslationProfilesForDisplay();
    return NextResponse.json({ profiles });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await safeReadJson(request);
    const profile = await createTranslationProfile(payload);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
