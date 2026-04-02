import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserReadingPreferences } from "@/app/lib/reading-preferences";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

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
