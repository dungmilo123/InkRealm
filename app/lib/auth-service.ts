import { prisma } from "@/app/lib/prisma";

type UnlinkResult =
  | { success: true }
  | { error: string; status: 400 | 404 };

/**
 * Unlink Google OAuth account from a user.
 * Validates that the user exists, has a linked Google account,
 * and has a password set before unlinking.
 */
export async function unlinkGoogleAccount(userId: string): Promise<UnlinkResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (!user) {
    return { error: "User not found", status: 404 };
  }

  if (user.accounts.length === 0) {
    return { error: "No Google account linked", status: 400 };
  }

  if (!user.passwordHash) {
    return { error: "Set a password before unlinking Google", status: 400 };
  }

  await prisma.account.deleteMany({
    where: { userId, provider: "google" },
  });

  return { success: true };
}
