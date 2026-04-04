import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

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

/** Generates a UUID-based storage key preserving the original file extension. */
export function generateStorageKey(originalFileName: string): string {
  const ext = getExtension(originalFileName);
  return `novels/${randomUUID()}${ext ? `.${ext}` : ""}`;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Writes a novel file buffer to R2 storage.
 * Returns the storage key (not a local path).
 */
export async function writeNovelFile(
  storageKey: string,
  buffer: Buffer
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: buffer,
    })
  );

  return storageKey;
}

/**
 * Reads a novel file from R2 storage by its storage key.
 * Returns a Buffer for compatibility with the reader/parser pipeline.
 */
export async function readNovelFile(storageKey: string): Promise<Buffer> {
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

  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Deletes a novel file from R2 storage.
 * Silently succeeds if the object doesn't exist.
 */
export async function deleteNovelFile(storageKey: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    })
  );
}
