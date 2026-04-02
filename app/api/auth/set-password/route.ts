import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcrypt";
import { validatePassword } from "@/app/lib/auth-validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = (await request.json()) as { password?: string };

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json(passwordError, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.passwordHash) {
    return NextResponse.json(
      { error: "Password already set. Use change password instead." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password!, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
