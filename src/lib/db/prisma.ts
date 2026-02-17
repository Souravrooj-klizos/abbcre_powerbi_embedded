import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const prismaLog =
  process.env.PRISMA_LOG === "error"
    ? (["error"] as const)
    : process.env.NODE_ENV === "development"
      ? (["query", "error", "warn"] as const)
      : (["error"] as const);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLog,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
