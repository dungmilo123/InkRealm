import { prisma } from "./prisma";
import type { ReaderTheme, ReaderFontFamily } from "@/app/generated/prisma/client";

export type ReadingPreferences = {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  maxWidth: number;
};

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  fontSize: 18,
  lineHeight: 1.75,
  theme: "LIGHT",
  fontFamily: "SERIF",
  maxWidth: 720,
};

/**
 * Loads the user's saved reading preferences, falling back to
 * {@link DEFAULT_READING_PREFERENCES} if none have been persisted yet.
 */
export async function getUserReadingPreferences(
  userId: string
): Promise<ReadingPreferences> {
  const prefs = await prisma.userReadingPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) return { ...DEFAULT_READING_PREFERENCES };

  return {
    fontSize: prefs.fontSize,
    lineHeight: prefs.lineHeight,
    theme: prefs.theme,
    fontFamily: prefs.fontFamily,
    maxWidth: prefs.maxWidth,
  };
}

/**
 * Validates and persists a partial update to reading preferences.
 * Creates the DB row on first use (upsert). Throws if any value falls
 * outside its allowed range (fontSize 12–32, lineHeight 1.25–2.5, etc.).
 */
export async function updateUserReadingPreferences(
  userId: string,
  partial: Partial<ReadingPreferences>
): Promise<ReadingPreferences> {
  const validated: Partial<ReadingPreferences> = {};

  if (partial.fontSize !== undefined) {
    const fs = Math.round(partial.fontSize);
    if (fs < 12 || fs > 32) throw new Error("fontSize must be between 12 and 32");
    validated.fontSize = fs;
  }

  if (partial.lineHeight !== undefined) {
    if (partial.lineHeight < 1.25 || partial.lineHeight > 2.5)
      throw new Error("lineHeight must be between 1.25 and 2.5");
    validated.lineHeight = partial.lineHeight;
  }

  if (partial.maxWidth !== undefined) {
    const mw = Math.round(partial.maxWidth);
    if (mw < 500 || mw > 1000) throw new Error("maxWidth must be between 500 and 1000");
    validated.maxWidth = mw;
  }

  if (partial.theme !== undefined) {
    if (partial.theme !== "LIGHT" && partial.theme !== "DARK")
      throw new Error("theme must be LIGHT or DARK");
    validated.theme = partial.theme;
  }

  if (partial.fontFamily !== undefined) {
    if (partial.fontFamily !== "SANS" && partial.fontFamily !== "SERIF")
      throw new Error("fontFamily must be SANS or SERIF");
    validated.fontFamily = partial.fontFamily;
  }

  const result = await prisma.userReadingPreferences.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_READING_PREFERENCES, ...validated },
    update: validated,
  });

  return {
    fontSize: result.fontSize,
    lineHeight: result.lineHeight,
    theme: result.theme,
    fontFamily: result.fontFamily,
    maxWidth: result.maxWidth,
  };
}
