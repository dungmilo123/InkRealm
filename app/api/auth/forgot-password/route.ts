import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/app/lib/email";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

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
