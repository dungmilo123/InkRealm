import { NextResponse } from "next/server";
import { startTranslation, resumeTranslation, getTranslationProgress } from "@/app/lib/translation-runner";
import { getTranslationProfile } from "@/app/lib/translation";
import { isTranslationConfigured } from "@/app/lib/encryption";

export async function POST(request: Request) {
  try {
    if (!isTranslationConfigured()) {
      return NextResponse.json(
        { error: "Translation is not configured. Please set the TRANSLATION_ENCRYPTION_SECRET environment variable." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, novelId, translationId, targetLanguage } = body;

    if (action === "start") {
      if (!novelId || !targetLanguage) {
        return NextResponse.json(
          { error: "novelId and targetLanguage are required" },
          { status: 400 }
        );
      }

      const profile = await getTranslationProfile();
      if (!profile) {
        return NextResponse.json(
          { error: "No translation profile configured. Please configure your translation settings first." },
          { status: 400 }
        );
      }

      const result = await startTranslation(novelId, targetLanguage);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, translationId: result.translationId });
    }

    if (action === "resume") {
      if (!translationId) {
        return NextResponse.json(
          { error: "translationId is required" },
          { status: 400 }
        );
      }

      const result = await resumeTranslation(translationId);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'start' or 'resume'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const translationId = url.searchParams.get("translationId");

    if (!translationId) {
      return NextResponse.json(
        { error: "translationId is required" },
        { status: 400 }
      );
    }

    const progress = await getTranslationProgress(translationId);
    
    if (!progress) {
      return NextResponse.json(
        { error: "Translation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Translation progress error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}