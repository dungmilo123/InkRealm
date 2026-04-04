import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  const base = new PrismaClient({ adapter });

  if (process.env.PRISMA_QUERY_LOG === "true") {
    return base.$extends({
      query: {
        $allOperations({ operation, model, args, query }) {
          const start = performance.now();
          return query(args).then((result) => {
            const duration = performance.now() - start;
            console.log(`[prisma] ${model}.${operation} ${duration.toFixed(1)}ms`);
            return result;
          });
        },
      },
    }) as unknown as PrismaClient;
  }

  return base;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
