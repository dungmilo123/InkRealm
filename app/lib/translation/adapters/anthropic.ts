import { TranslationProvider } from "@/app/generated/prisma/client";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  parseTranslationPayload,
} from "./shared";
import type {
  TranslateChapterInput,
  TranslationAdapter,
  TranslationAdapterContext,
} from "./types";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

function resolveBaseUrl(customBaseUrl: string | null) {
  if (!customBaseUrl) {
    return DEFAULT_ANTHROPIC_BASE_URL;
  }

  return customBaseUrl.trim().replace(/\/$/, "");
}

export class AnthropicAdapter implements TranslationAdapter {
  async translateChapter(
    context: TranslationAdapterContext,
    input: TranslateChapterInput
  ) {
    if (context.provider !== TranslationProvider.ANTHROPIC) {
      throw new TranslationHttpError(
        500,
        `Provider ${context.provider} is not supported by Anthropic adapter.`
      );
    }

    const response = await fetch(`${resolveBaseUrl(context.baseUrl)}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": context.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: context.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: buildTranslationSystemPrompt(input.targetLanguage, input.glossary),
        messages: [
          {
            role: "user",
            content: buildTranslationUserPrompt(input, input.previousContext),
          },
        ],
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new TranslationHttpError(
        502,
        `Translation provider request failed (${response.status}): ${responseText}`
      );
    }

    const json = (await response.json()) as {
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    };

    const textParts = (json.content ?? [])
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim();

    if (!textParts) {
      throw new TranslationHttpError(502, "Translation provider returned no content.");
    }

    return parseTranslationPayload(textParts);
  }
}
