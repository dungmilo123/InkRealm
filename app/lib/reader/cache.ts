import type { ReaderDocument } from "./types";

const MAX_CACHE_SIZE = 10;
const cache = new Map<string, ReaderDocument>();

function cacheKey(novelId: string, updatedAt: Date): string {
  return `${novelId}:${updatedAt.getTime()}`;
}

export function getCachedDocument(
  novelId: string,
  updatedAt: Date
): ReaderDocument | undefined {
  return cache.get(cacheKey(novelId, updatedAt));
}

export function setCachedDocument(
  novelId: string,
  updatedAt: Date,
  document: ReaderDocument
): void {
  const key = cacheKey(novelId, updatedAt);

  if (cache.has(key)) {
    cache.delete(key);
  }

  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, document);
}

export function invalidateCachedDocument(novelId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${novelId}:`)) {
      cache.delete(key);
    }
  }
}

export function clearDocumentCache(): void {
  cache.clear();
}
