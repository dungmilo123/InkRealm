import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { TranslationStatus } from "@/app/generated/prisma/client";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "inkrealm-novel-storage";

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export type ExportChapter = {
  chapterIndex: number;
  translatedTitle: string | null;
  translatedContent: string | null;
};

export function buildTranslatedExportText(input: {
  novelTitle: string;
  targetLanguage: string;
  chapters: ExportChapter[];
}) {
  const ordered = [...input.chapters].sort(
    (left, right) => left.chapterIndex - right.chapterIndex
  );

  const lines: string[] = [
    `${input.novelTitle} (${input.targetLanguage} translation)`,
    "",
  ];

  for (const chapter of ordered) {
    lines.push(
      `Chapter ${chapter.chapterIndex}: ${chapter.translatedTitle ?? `Chapter ${chapter.chapterIndex}`}`
    );
    lines.push("");
    lines.push(chapter.translatedContent ?? "");
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9\-\s_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function writeTranslatedExportFile(input: {
  translationId: string;
  novelTitle: string;
  targetLanguage: string;
  chapters: ExportChapter[];
}) {
  const client = getR2Client();

  const safeNovelName = sanitizeFileName(input.novelTitle) || "novel";
  const safeLanguage = sanitizeFileName(input.targetLanguage) || "translated";
  const fileName = `${safeNovelName}-${safeLanguage}-${input.translationId}.txt`;
  const storageKey = `translations/${fileName}`;

  const content = buildTranslatedExportText({
    novelTitle: input.novelTitle,
    targetLanguage: input.targetLanguage,
    chapters: input.chapters,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: content,
      ContentType: "text/plain; charset=utf-8",
    })
  );

  return {
    fileName,
    filePath: storageKey, // Now returns R2 key instead of local path
  };
}

export function canDownloadTranslationExport(input: {
  status: TranslationStatus;
  exportPath: string | null;
}) {
  return input.status === TranslationStatus.COMPLETED && Boolean(input.exportPath);
}

export async function readTranslatedExportFile(storageKey: string): Promise<Buffer> {
  const client = getR2Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${storageKey}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Deletes a translated export file from R2 storage.
 * Silently succeeds if the object doesn't exist.
 */
export async function deleteTranslatedExportFile(storageKey: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    })
  );
}
