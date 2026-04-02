import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { unlinkGoogleAccount } from "@/app/lib/auth-service";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  const result = await unlinkGoogleAccount(session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
