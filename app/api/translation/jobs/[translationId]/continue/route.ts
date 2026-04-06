import { after, NextResponse } from "next/server";
import {
  runTranslationJobBatch,
  triggerTranslationContinuation,
} from "@/app/lib/translation/service";
import { handleTranslationRouteError } from "@/app/lib/translation/http";

/**
 * Internal continuation endpoint — called to resume a translation batch
 * in a fresh function invocation.
 *
 * Returns immediately and does all heavy work (translating a chapter)
 * inside `after()`, which gets its own execution budget on Vercel.
 * When more chapters remain, triggers the next continuation directly
 * (not via nested after()) to keep the chain alive.
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

    // Do all heavy work in after() so the response returns immediately.
    // after() gets its own execution budget after the response is sent.
    after(async () => {
      try {
        const result = await runTranslationJobBatch({
          translationId,
          allowFailedState: true,
          userId,
        });

        if (result === "continue") {
          // Await the continuation trigger to ensure the HTTP request
          // is fully sent before this after() callback completes and
          // the function is torn down.
          await triggerTranslationContinuation({ translationId, userId });
        }
      } catch (error) {
        console.error("Translation continuation batch failed", {
          translationId,
          error,
        });
      }
    });

    return NextResponse.json({ status: "accepted" });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
