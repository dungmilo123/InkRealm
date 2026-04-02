import { prisma } from "@/app/lib/prisma";

export async function getUserWithAccounts(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: { where: { provider: "google" } } },
  });
}
