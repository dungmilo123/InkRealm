import { NextResponse } from "next/server";
import { TranslationHttpError, toErrorMessage } from "@/app/lib/translation/errors";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleTranslationRouteError(error: unknown) {
  if (error instanceof TranslationHttpError) {
    return jsonError(error.status, error.message);
  }

  console.error("Translation route error", { error });
  return jsonError(500, toErrorMessage(error));
}

export async function safeReadJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TranslationHttpError(400, "Request body must be valid JSON.");
  }
}
