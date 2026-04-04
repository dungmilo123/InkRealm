import { after, NextResponse } from "next/server";
import {
  runTranslationJobBatch,
  triggerTranslationContinuation,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

/**
 * Internal continuation endpoint — called by `after()` to resume a
 * translation batch in a fresh function invocation, avoiding the
 * function timeout that kills long-running `after()` callbacks.
 *
 * Authenticated via `x-internal-token` header (must match AUTH_SECRET).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const token = request.headers.get("x-internal-token");
    if (token !== process.env.AUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { translationId } = await context.params;
    const body = await request.json();
    const userId = body.userId as string;
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const result = await runTranslationJobBatch({
      translationId,
      allowFailedState: true,
      userId,
    });

    if (result === "continue") {
      after(async () => {
        await triggerTranslationContinuation({ translationId, userId });
      });
      return NextResponse.json({ status: "continuing" });
    }

    return NextResponse.json({ status: "done", job: result });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
