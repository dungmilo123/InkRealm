// app/lib/format.ts

/**
 * Formats a byte count as a human-readable string.
 * Examples: 512 → "512 B", 2048 → "2.0 KB", 3145728 → "3.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
