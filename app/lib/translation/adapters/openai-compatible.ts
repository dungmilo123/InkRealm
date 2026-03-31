import {
  TranslationProvider,
  type TranslationProvider as TranslationProviderType,
} from "@/app/generated/prisma/client";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  parseTranslationPayload,
} from "./shared";
import type {
  TranslateChapterInput,
  TranslateChapterOutput,
  TranslationAdapter,
  TranslationAdapterContext,
} from "./types";

const DEFAULT_OPENAI_COMPAT_BASE_URL: Record<string, string> = {
  [TranslationProvider.OPENAI]: "https://api.openai.com/v1",
  [TranslationProvider.DEEPSEEK]: "https://api.deepseek.com",
  [TranslationProvider.OPENROUTER]: "https://openrouter.ai/api/v1",
};

function resolveBaseUrl(context: TranslationAdapterContext) {
  const normalized = context.baseUrl?.trim();
  if (normalized) {
    return normalized.replace(/\/$/, "");
  }

  const fallback =
    DEFAULT_OPENAI_COMPAT_BASE_URL[
      context.provider as keyof typeof DEFAULT_OPENAI_COMPAT_BASE_URL
    ];
  if (!fallback) {
    throw new TranslationHttpError(
      500,
      `No default base URL for provider ${context.provider}.`
    );
  }

  return fallback;
}

function extractContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }

        const text = (item as Record<string, unknown>).text;
        return typeof text === "string" ? text : "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function performOpenAiCompatibleRequest(
  context: TranslationAdapterContext,
  input: TranslateChapterInput
): Promise<TranslateChapterOutput> {
  const baseUrl = resolveBaseUrl(context);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${context.apiKey}`,
    },
    body: JSON.stringify({
      model: context.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildTranslationSystemPrompt(input.targetLanguage, input.glossary, context.customPrompt),
        },
        {
          role: "user",
          content: buildTranslationUserPrompt(input, input.previousContext),
        },
      ],
      response_format: {
        type: "json_object",
      },
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
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  const rawContent = extractContent(json.choices?.[0]?.message?.content);
  if (!rawContent) {
    throw new TranslationHttpError(502, "Translation provider returned no content.");
  }

  return parseTranslationPayload(rawContent);
}

export class OpenAiCompatibleAdapter implements TranslationAdapter {
  readonly supportedProviders: TranslationProviderType[];

  constructor(supportedProviders: TranslationProviderType[]) {
    this.supportedProviders = supportedProviders;
  }

  async translateChapter(
    context: TranslationAdapterContext,
    input: TranslateChapterInput
  ) {
    if (!this.supportedProviders.includes(context.provider)) {
      throw new TranslationHttpError(
        500,
        `Provider ${context.provider} is not supported by this adapter.`
      );
    }

    return performOpenAiCompatibleRequest(context, input);
  }
}
