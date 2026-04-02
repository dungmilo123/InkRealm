import { prisma } from "@/app/lib/prisma";

/**
 * Fetches a user by id and includes only accounts with provider `"google"`.
 *
 * @param userId - The id of the user to retrieve.
 * @returns The user record with `accounts` limited to those where `provider` is `"google"`, or `null` if no user matches.
 */
export async function getUserWithAccounts(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: { where: { provider: "google" } } },
  });
}
