import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcrypt";
import { validatePassword } from "@/app/lib/auth-validation";
import {
  authActionLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = authActionLimiter.check(ip);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const { session, response } = await requireAuth();
  if (response) return response;

  const { currentPassword, newPassword } = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 }
    );
  }

  const passwordError = validatePassword(newPassword, "New password");
  if (passwordError) {
    return NextResponse.json(passwordError, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "No password set. Use set password instead." },
      { status: 400 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword!, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
