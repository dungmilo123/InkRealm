import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/app/lib/auth-validation";
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

  const body = await request.json();
  const { email: rawEmail, password } = body as {
    email?: string;
    password?: string;
  };

  // Validate input using shared rules
  const emailError = validateEmail(rawEmail);
  if (emailError) {
    return NextResponse.json(emailError, { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json(passwordError, { status: 400 });
  }

  const email = normalizeEmail(rawEmail!);

  // Check for existing user
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (existing) {
    if (existing.accounts.length > 0) {
      return NextResponse.json(
        {
          error:
            "This email is linked to a Google account. Sign in with Google, then set a password from Settings.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 }
    );
  }

  // Create user with hashed password
  const passwordHash = await bcrypt.hash(password!, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  // Create database session directly
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  // Set session cookie
  const response = NextResponse.json({ success: true }, { status: 201 });
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  return response;
}
