import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  updateUserReadingPreferences,
  type ReadingPreferences,
} from "@/app/lib/reading-preferences";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

/** Fields accepted by the reading preferences endpoint. */
const ALLOWED_KEYS = new Set<keyof ReadingPreferences>([
  "fontSize",
  "lineHeight",
  "theme",
  "fontFamily",
  "maxWidth",
]);

export async function PUT(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const unknownKeys = Object.keys(body).filter(
    (k) => !ALLOWED_KEYS.has(k as keyof ReadingPreferences)
  );
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown fields: ${unknownKeys.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const preferences = await updateUserReadingPreferences(session.user.id, body);
    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
