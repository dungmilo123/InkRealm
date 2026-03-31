import { decryptApiKey } from "./encryption";
import type { TranslationProvider } from "../generated/prisma/client";

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translatedText: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderAdapter {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface DeepSeekConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface MiniMaxConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

function buildTranslationPrompt(text: string, targetLanguage: string): string {
  return `You are a professional translator. Translate the text below to ${targetLanguage} exactly as-is, preserving paragraph breaks. Do NOT add any commentary, explanations, or the original text. Only output the translation.

Text to translate:
${text}

${targetLanguage} translation:`;
}

async function callOpenAI(config: OpenAIConfig, request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const url = `${baseUrl}/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: buildTranslationPrompt(request.text, request.targetLanguage),
        },
      ],
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    translatedText: data.choices[0]?.message?.content || "",
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function callAnthropic(config: AnthropicConfig, request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
  const url = `${baseUrl}/messages`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildTranslationPrompt(request.text, request.targetLanguage),
        },
      ],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    translatedText: data.content[0]?.text || "",
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined,
  };
}

async function callDeepSeek(config: DeepSeekConfig, request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = config.baseUrl || "https://api.deepseek.com/v1";
  const url = `${baseUrl}/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: buildTranslationPrompt(request.text, request.targetLanguage),
        },
      ],
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    translatedText: data.choices[0]?.message?.content || "",
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function callOpenRouter(config: OpenRouterConfig, request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
  const url = `${baseUrl}/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "https://github.com",
      "X-Title": "Novel Translation App",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: buildTranslationPrompt(request.text, request.targetLanguage),
        },
      ],
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    translatedText: data.choices[0]?.message?.content || "",
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function callMiniMax(config: MiniMaxConfig, request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = config.baseUrl || "https://api.minimax.io/v1";
  const url = `${baseUrl}/text/chatcompletion_v2`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: buildTranslationPrompt(request.text, request.targetLanguage),
        },
      ],
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    translatedText: data.choices[0]?.message?.content || "",
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

export interface TranslationConfig {
  provider: TranslationProvider;
  model: string;
  encryptedApiKey: string;
  baseUrl?: string | null;
}

export async function createProviderAdapter(config: TranslationConfig): Promise<ProviderAdapter> {
  const apiKey = decryptApiKey(config.encryptedApiKey);
  
  switch (config.provider) {
    case "OPENAI":
      return {
        translate: (request) => callOpenAI({ apiKey, model: config.model, baseUrl: config.baseUrl || undefined }, request),
      };
    case "ANTHROPIC":
      return {
        translate: (request) => callAnthropic({ apiKey, model: config.model, baseUrl: config.baseUrl || undefined }, request),
      };
    case "DEEPSEEK":
      return {
        translate: (request) => callDeepSeek({ apiKey, model: config.model, baseUrl: config.baseUrl || undefined }, request),
      };
    case "OPENROUTER":
      return {
        translate: (request) => callOpenRouter({ apiKey, model: config.model, baseUrl: config.baseUrl || undefined }, request),
      };
    case "MINIMAX":
      return {
        translate: (request) => callMiniMax({ apiKey, model: config.model, baseUrl: config.baseUrl || undefined }, request),
      };
    default:
      throw new Error(`Unsupported translation provider: ${config.provider}`);
  }
}

export function getModelOptions(provider: TranslationProvider): string[] {
  switch (provider) {
    case "OPENAI":
      return [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
      ];
    case "ANTHROPIC":
      return [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
      ];
    case "DEEPSEEK":
      return [
        "deepseek-chat",
        "deepseek-coder",
      ];
    case "OPENROUTER":
      return [
        "anthropic/claude-3.5-sonnet",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash-thinking-exp",
        "deepseek/deepseek-chat-v3-0324",
      ];
    case "MINIMAX":
      return [
        "MiniMax-M2.7",
      ];
    default:
      return [];
  }
}