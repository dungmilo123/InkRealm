import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/app/lib/email";
import { normalizeEmail, validateEmail } from "@/app/lib/auth-validation";
import {
  authLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = authLimiter.check(ip);
  if (!rl.allowed) {
    return rateLimitResponse(rl);
  }

  const { email: rawEmail } = (await request.json()) as { email?: string };

  const emailError = validateEmail(rawEmail);
  if (emailError) {
    return NextResponse.json(emailError, { status: 400 });
  }

  const email = normalizeEmail(rawEmail!);

  // Always return the same message to prevent email enumeration
  const genericMessage = "If an account exists, a reset link has been sent.";

  const user = await prisma.user.findUnique({ where: { email } });

  // Only send email if user exists and has a password
  if (user?.passwordHash) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    const baseUrl = new URL(request.url).origin;
    await sendPasswordResetEmail(email, token, baseUrl);
  }

  return NextResponse.json({ message: genericMessage });
}
