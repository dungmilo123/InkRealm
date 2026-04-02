import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * Authenticated session with a guaranteed `user.id`.
 *
 * Auth.js types `Session.user` as optional, but after the `requireAuth()`
 * guard succeeds the user and their ID are guaranteed to exist.  This
 * narrowed type lets callers access `session.user.id` without optional
 * chaining.
 */
export type AuthenticatedSession = Session & {
  user: { id: string };
};

type RequireAuthSuccess = { session: AuthenticatedSession; response: null };
type RequireAuthFailure = { session: null; response: NextResponse };
type RequireAuthResult = RequireAuthSuccess | RequireAuthFailure;

/**
 * Validate the caller's session in an API route handler.
 *
 * Returns a discriminated union:
 * - On success: `{ session, response: null }` — `session.user.id` is
 *   guaranteed to be a non-empty string.
 * - On failure: `{ session: null, response }` — a pre-built 401 JSON
 *   response that the handler should return immediately.
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const { session, response } = await requireAuth();
 *   if (response) return response;
 *
 *   // session.user.id is guaranteed here
 *   const data = await fetchUserData(session.user.id);
 *   return NextResponse.json({ data });
 * }
 * ```
 */
export async function requireAuth(): Promise<RequireAuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { session: session as AuthenticatedSession, response: null };
}
