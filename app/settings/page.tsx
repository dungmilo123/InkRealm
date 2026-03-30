import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { redirect } from "next/navigation";
import { listTranslationProfilesForDisplay } from "@/app/lib/translation/profiles";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, profiles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { accounts: { where: { provider: "google" } } },
    }),
    listTranslationProfilesForDisplay(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  const serializedProfiles = profiles.map((profile) => ({
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }));

  return (
    <SettingsClient
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        hasPassword: !!user.passwordHash,
        hasGoogle: user.accounts.length > 0,
      }}
      initialProfiles={serializedProfiles}
    />
  );
}
