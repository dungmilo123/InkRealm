import {
  GlossaryEntryStatus,
  GlossaryEntryType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { TranslationHttpError } from "@/app/lib/translation/errors";

const glossaryEntrySelect = {
  id: true,
  novelId: true,
  canonical: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  variants: {
    select: {
      id: true,
      variant: true,
    },
  },
} as const;

export type GlossaryEntryWithVariants = Awaited<
  ReturnType<typeof listGlossaryEntries>
>[number];

/**
 * Verifies that the given novel exists and belongs to the user.
 * Uses a minimal select (only `userId`) to avoid fetching the full Novel row.
 */
async function validateNovelOwnership(novelId: string, userId: string) {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { id: true, userId: true },
  });
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }
  return novel;
}

export async function listGlossaryEntries(novelId: string, userId: string) {
  await validateNovelOwnership(novelId, userId);

  return prisma.novelGlossaryEntry.findMany({
    where: { novelId },
    select: glossaryEntrySelect,
    orderBy: [
      { status: "asc" }, // CONFIRMED first (alphabetically before PENDING)
      { canonical: "asc" },
    ],
  });
}

export async function createGlossaryEntry(input: {
  novelId: string;
  canonical: string;
  type: GlossaryEntryType;
  variants: string[];
  userId: string;
}) {
  await validateNovelOwnership(input.novelId, input.userId);

  return prisma.novelGlossaryEntry.create({
    data: {
      novelId: input.novelId,
      canonical: input.canonical,
      type: input.type,
      status: GlossaryEntryStatus.CONFIRMED,
      variants: {
        create: input.variants.map((v) => ({ variant: v })),
      },
    },
    select: glossaryEntrySelect,
  });
}

export async function getGlossaryEntryById(entryId: string) {
  return prisma.novelGlossaryEntry.findUnique({
    where: { id: entryId },
    select: glossaryEntrySelect,
  });
}

/**
 * Fetches a glossary entry and verifies that its parent novel belongs to the
 * given user — in a single database round-trip (JOIN via `include`).
 *
 * Replaces the previous two-query pattern:
 *   `getGlossaryEntryById(id)` → `validateNovelOwnership(entry.novelId, userId)`
 */
async function getOwnedGlossaryEntry(entryId: string, userId: string) {
  const entry = await prisma.novelGlossaryEntry.findUnique({
    where: { id: entryId },
    select: {
      ...glossaryEntrySelect,
      novel: { select: { userId: true } },
    },
  });

  if (!entry) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  if (entry.novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }

  // Strip the `novel` field — callers expect the standard GlossaryEntry shape
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { novel: _novel, ...glossaryEntry } = entry;
  return glossaryEntry;
}

export async function updateGlossaryEntry(input: {
  entryId: string;
  canonical?: string;
  type?: GlossaryEntryType;
  variants?: string[];
  userId: string;
}) {
  await getOwnedGlossaryEntry(input.entryId, input.userId);

  return prisma.$transaction(async (tx) => {
    if (input.variants !== undefined) {
      await tx.novelGlossaryVariant.deleteMany({
        where: { entryId: input.entryId },
      });

      if (input.variants.length > 0) {
        await tx.novelGlossaryVariant.createMany({
          data: input.variants.map((v) => ({
            entryId: input.entryId,
            variant: v,
          })),
        });
      }
    }

    return tx.novelGlossaryEntry.update({
      where: { id: input.entryId },
      data: {
        ...(input.canonical !== undefined && { canonical: input.canonical }),
        ...(input.type !== undefined && { type: input.type }),
      },
      select: glossaryEntrySelect,
    });
  });
}

export async function deleteGlossaryEntry(entryId: string, userId: string) {
  await getOwnedGlossaryEntry(entryId, userId);

  await prisma.novelGlossaryEntry.delete({
    where: { id: entryId },
  });
}

export async function updateGlossaryEntryStatus(input: {
  entryId: string;
  status: GlossaryEntryStatus;
  canonical?: string;
  type?: GlossaryEntryType;
  variants?: string[];
  userId: string;
}) {
  await getOwnedGlossaryEntry(input.entryId, input.userId);

  if (input.status === GlossaryEntryStatus.CONFIRMED) {
    return prisma.$transaction(async (tx) => {
      if (input.variants !== undefined) {
        await tx.novelGlossaryVariant.deleteMany({
          where: { entryId: input.entryId },
        });
        if (input.variants.length > 0) {
          await tx.novelGlossaryVariant.createMany({
            data: input.variants.map((v) => ({
              entryId: input.entryId,
              variant: v,
            })),
          });
        }
      }

      return tx.novelGlossaryEntry.update({
        where: { id: input.entryId },
        data: {
          status: GlossaryEntryStatus.CONFIRMED,
          ...(input.canonical !== undefined && { canonical: input.canonical }),
          ...(input.type !== undefined && { type: input.type }),
        },
        select: glossaryEntrySelect,
      });
    });
  }

  // Dismiss = delete the pending entry
  await prisma.novelGlossaryEntry.delete({
    where: { id: input.entryId },
  });

  return null;
}

export async function listGlossaryEntriesForTranslation(novelId: string) {
  return prisma.novelGlossaryEntry.findMany({
    where: { novelId },
    select: glossaryEntrySelect,
  });
}

export async function createPendingGlossaryEntries(input: {
  novelId: string;
  terms: Array<{
    canonical: string;
    type?: string;
    variants?: string[];
  }>;
}) {
  const existing = await prisma.novelGlossaryEntry.findMany({
    where: { novelId: input.novelId },
    select: { canonical: true, variants: { select: { variant: true } } },
  });

  const existingCanonicals = new Set(
    existing.map((e) => e.canonical.toLowerCase())
  );
  const existingVariants = new Set(
    existing.flatMap((e) => e.variants.map((v) => v.variant.toLowerCase()))
  );

  const newTerms = input.terms.filter((term) => {
    const lower = term.canonical.toLowerCase();
    return !existingCanonicals.has(lower) && !existingVariants.has(lower);
  });

  if (newTerms.length === 0) return [];

  // Step 1: Batch-create all glossary entries and get back their IDs
  const createdEntries = await prisma.novelGlossaryEntry.createManyAndReturn({
    data: newTerms.map((term) => ({
      novelId: input.novelId,
      canonical: term.canonical,
      type: parseGlossaryEntryType(term.type),
      status: GlossaryEntryStatus.PENDING,
    })),
    select: {
      id: true,
      novelId: true,
      canonical: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Step 2: Build variant data referencing the created entry IDs
  const variantData: Array<{ entryId: string; variant: string }> = [];
  for (let i = 0; i < createdEntries.length; i++) {
    const entry = createdEntries[i];
    const termVariants = newTerms[i].variants ?? [];
    for (const variant of termVariants) {
      variantData.push({ entryId: entry.id, variant });
    }
  }

  // Step 3: Batch-create all variants
  if (variantData.length > 0) {
    await prisma.novelGlossaryVariant.createMany({
      data: variantData,
    });
  }

  // Step 4: Re-query entries with variants to match expected return shape
  if (createdEntries.length === 0) return [];

  const createdIds = createdEntries.map((e) => e.id);
  return prisma.novelGlossaryEntry.findMany({
    where: { id: { in: createdIds } },
    select: glossaryEntrySelect,
  });
}

function parseGlossaryEntryType(value?: string): GlossaryEntryType {
  if (!value) return GlossaryEntryType.OTHER;
  const upper = value.toUpperCase();
  if (upper in GlossaryEntryType) {
    return upper as GlossaryEntryType;
  }
  return GlossaryEntryType.OTHER;
}
