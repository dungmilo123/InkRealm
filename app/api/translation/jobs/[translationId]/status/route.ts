import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTranslationJobStatus } from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { translationId } = await context.params;

    const job = await getTranslationJobStatus(translationId, session.user.id);

    return NextResponse.json({ job });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
