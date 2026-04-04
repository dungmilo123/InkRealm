import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Reuse pg Pool across requests for connection efficiency.
  // With Neon's pooler endpoint (-pooler in hostname), this reduces
  // connection overhead significantly.
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: 10, // Max connections in local pool (Neon pooler handles the rest)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
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
