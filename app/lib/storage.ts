import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = join(process.cwd(), "storage", "novels");

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

export function generateStorageKey(originalFileName: string): string {
  const ext = getExtension(originalFileName);
  return `${randomUUID()}${ext ? `.${ext}` : ""}`;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

export async function writeNovelFile(
  storageKey: string,
  buffer: Buffer
): Promise<string> {
  await ensureStorageDir();
  const filePath = join(STORAGE_DIR, storageKey);
  await writeFile(filePath, buffer);
  return filePath;
}

export function getStoragePath(storageKey: string): string {
  return join(STORAGE_DIR, storageKey);
}