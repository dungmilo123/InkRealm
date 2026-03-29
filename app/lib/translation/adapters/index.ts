import { TranslationProvider } from "@/app/generated/prisma/client";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import { AnthropicAdapter } from "./anthropic";
import { OpenAiCompatibleAdapter } from "./openai-compatible";
import type { TranslationAdapter } from "./types";

const openAiCompatibleAdapter = new OpenAiCompatibleAdapter([
  TranslationProvider.OPENAI,
  TranslationProvider.DEEPSEEK,
  TranslationProvider.OPENROUTER,
  TranslationProvider.MINIMAX,
]);

const anthropicAdapter = new AnthropicAdapter();

const ADAPTER_BY_PROVIDER: Record<TranslationProvider, TranslationAdapter> = {
  [TranslationProvider.OPENAI]: openAiCompatibleAdapter,
  [TranslationProvider.ANTHROPIC]: anthropicAdapter,
  [TranslationProvider.DEEPSEEK]: openAiCompatibleAdapter,
  [TranslationProvider.OPENROUTER]: openAiCompatibleAdapter,
  [TranslationProvider.MINIMAX]: openAiCompatibleAdapter,
};

export function getTranslationAdapter(provider: TranslationProvider) {
  const adapter = ADAPTER_BY_PROVIDER[provider];
  if (!adapter) {
    throw new TranslationHttpError(
      500,
      `No translation adapter registered for ${provider}.`
    );
  }

  return adapter;
}

export type {
  TranslateChapterInput,
  TranslateChapterOutput,
  TranslationAdapterContext,
} from "./types";
