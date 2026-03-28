const ALLOWED_EXTENSIONS = new Set(["txt", "epub"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "application/epub+zip",
]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUpload(
  file: File
): ValidationResult {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${file.type}. Allowed types: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}