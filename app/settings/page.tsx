import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        hasPassword: !!user.passwordHash,
        hasGoogle: user.accounts.length > 0,
      }}
    />
  );
}
