// app/lib/format.ts

/**
 * Convert a byte count into a human-readable size string using B, KB, or MB.
 *
 * @param bytes - Number of bytes to format.
 * @returns The formatted size: "`<n> B`" for values less than 1024; "`<x.x> KB`" for values less than 1,048,576; "`<x.x> MB`" for larger values. KB and MB use one decimal place.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
