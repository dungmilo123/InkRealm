import { NextResponse } from "next/server";
import {
  createTranslationJobFromNovelDetails,
  listNovelTranslationJobViews,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { parseStartTranslationPayload } from "@/app/lib/translation/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const { novelId } = await context.params;
    const jobs = await listNovelTranslationJobViews(novelId);
    return NextResponse.json({ jobs });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const payload = await safeReadJson(request);
    const { novelId } = await context.params;
    const parsed = parseStartTranslationPayload(payload);

    const job = await createTranslationJobFromNovelDetails({
      novelId,
      profileId: parsed.profileId,
      targetLanguage: parsed.targetLanguage,
      batchSize: parsed.batchSize,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
