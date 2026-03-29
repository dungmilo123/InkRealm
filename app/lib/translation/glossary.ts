import {
  GlossaryEntryStatus,
  GlossaryEntryType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getNovelById } from "@/app/lib/novels";
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

async function validateNovelOwnership(novelId: string, userId: string) {
  const novel = await getNovelById(novelId);
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

export async function updateGlossaryEntry(input: {
  entryId: string;
  canonical?: string;
  type?: GlossaryEntryType;
  variants?: string[];
  userId: string;
}) {
  const entry = await getGlossaryEntryById(input.entryId);
  if (!entry) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  await validateNovelOwnership(entry.novelId, input.userId);

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
  const entry = await getGlossaryEntryById(entryId);
  if (!entry) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  await validateNovelOwnership(entry.novelId, userId);

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
  const entry = await getGlossaryEntryById(input.entryId);
  if (!entry) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  await validateNovelOwnership(entry.novelId, input.userId);

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

  const created = [];
  for (const term of newTerms) {
    const type = parseGlossaryEntryType(term.type);
    const entry = await prisma.novelGlossaryEntry.create({
      data: {
        novelId: input.novelId,
        canonical: term.canonical,
        type,
        status: GlossaryEntryStatus.PENDING,
        variants: {
          create: (term.variants ?? []).map((v) => ({ variant: v })),
        },
      },
      select: glossaryEntrySelect,
    });
    created.push(entry);
  }

  return created;
}

function parseGlossaryEntryType(value?: string): GlossaryEntryType {
  if (!value) return GlossaryEntryType.OTHER;
  const upper = value.toUpperCase();
  if (upper in GlossaryEntryType) {
    return upper as GlossaryEntryType;
  }
  return GlossaryEntryType.OTHER;
}
