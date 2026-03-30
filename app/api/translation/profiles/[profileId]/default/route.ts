import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setDefaultProfile } from "@/app/lib/translation/profiles";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

export async function PUT(
  _request: Request,
  context: { params: Promise<{ profileId: string }> }
) {
  try {
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
