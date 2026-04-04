import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = join(process.cwd(), "storage", "novels");

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

/** Generates a UUID-based storage key preserving the original file extension. */
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

/**
 * Writes a novel file buffer to `storage/novels/`, creating the directory
 * if it doesn't exist. Returns the absolute file path written.
 */
export async function writeNovelFile(
  storageKey: string,
  buffer: Buffer
): Promise<string> {
  await ensureStorageDir();
  const filePath = join(STORAGE_DIR, storageKey);
  await writeFile(filePath, buffer);
  return filePath;
}

/**
 * Reads a novel file from local storage by its absolute path.
 * Returns a Buffer for compatibility with the reader/parser pipeline.
 */
export async function readNovelFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Deletes a novel file from local storage.
 * Silently ignores ENOENT (file already removed / never written).
 */
export async function deleteNovelFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
}
