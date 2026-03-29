import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
