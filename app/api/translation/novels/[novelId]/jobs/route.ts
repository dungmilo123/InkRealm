import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId } = await context.params;
    const jobs = await listNovelTranslationJobViews(novelId, session.user.id);
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await safeReadJson(request);
    const { novelId } = await context.params;
    const parsed = parseStartTranslationPayload(payload);

    const job = await createTranslationJobFromNovelDetails({
      novelId,
      profileId: parsed.profileId,
      targetLanguage: parsed.targetLanguage,
      batchSize: parsed.batchSize,
      userId: session.user.id,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
