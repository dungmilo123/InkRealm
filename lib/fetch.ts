/**
 * Client-side fetch utilities.
 *
 * These helpers are designed for "use client" components that call
 * API routes and need consistent JSON error handling.
 */

/**
 * Parse a `Response` as JSON, throwing on non-2xx status.
 *
 * The server's `{ error: string }` body is surfaced as the Error
 * message so callers can display it directly in the UI.
 *
 * @example
 * const profile = await readJsonOrError<TranslationProfile>(
 *   await fetch("/api/translation/profiles", { method: "POST", … })
 * );
 */
export async function readJsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}
