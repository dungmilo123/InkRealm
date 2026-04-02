/**
 * Client-safe upload validation.
 *
 * Mirrors the rules in app/lib/validation.ts (server-side) so the UI can
 * reject invalid files instantly — before they travel the network.
 */

const ALLOWED_EXTENSIONS = new Set(["txt", "epub"]);
const ALLOWED_MIME_TYPES = new Set(["text/plain", "application/epub+zip"]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadClient(file: File): UploadValidationResult {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Invalid file type ".${ext || "unknown"}". Allowed: .txt, .epub`,
    };
  }

  // MIME type check — some browsers report empty MIME for certain extensions,
  // so we only reject when a MIME *is* present and is wrong.
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Unexpected MIME type "${file.type}". Expected text/plain or application/epub+zip`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${formatSize(file.size)}). Maximum: ${formatSize(MAX_FILE_SIZE_BYTES)}`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  return { valid: true };
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot + 1).toLowerCase();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
