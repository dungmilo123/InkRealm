import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { prisma } from "@/app/lib/prisma";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = apiLimiter.check(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { session, response } = await requireAuth();
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.accounts.length === 0) {
    return NextResponse.json(
      { error: "No Google account linked" },
      { status: 400 }
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Set a password before unlinking Google" },
      { status: 400 }
    );
  }

  await prisma.account.deleteMany({
    where: { userId: session.user.id, provider: "google" },
  });

  return NextResponse.json({ success: true });
}
