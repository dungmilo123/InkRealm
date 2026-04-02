import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcrypt";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/app/lib/auth-validation";

export async function POST(request: Request) {
  const { email: rawEmail, token, password } = (await request.json()) as {
    email?: string;
    token?: string;
    password?: string;
  };

  const emailError = validateEmail(rawEmail);
  if (emailError) {
    return NextResponse.json(emailError, { status: 400 });
  }

  if (!token) {
    return NextResponse.json(
      { error: "Reset token is required" },
      { status: 400 }
    );
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json(passwordError, { status: 400 });
  }

  const email = normalizeEmail(rawEmail!);

  // Find the token
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });

  if (!verificationToken) {
    return NextResponse.json(
      { error: "Invalid reset link. Please request a new one." },
      { status: 400 }
    );
  }

  if (verificationToken.expires < new Date()) {
    // Clean up expired token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  // Update password and delete token
  const passwordHash = await bcrypt.hash(password!, 12);

  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return NextResponse.json({ success: true });
}
