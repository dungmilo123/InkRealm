import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getUserWithAccounts } from "@/app/lib/users";
import { listTranslationProfilesForDisplay } from "@/app/lib/translation/profiles";
import { LibraryShelf } from "@/components/library-shelf";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, profiles] = await Promise.all([
    getUserWithAccounts(session.user.id),
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
    <LibraryShelf
      activeRoute="settings"
      user={session.user}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
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
    </LibraryShelf>
  );
}
