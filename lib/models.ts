// Category -> model mapping. Edit slugs here as OpenRouter pricing/quality shifts.
// Verify at https://openrouter.ai/models

export type Category =
  | "code"
  | "reasoning"
  | "creative"
  | "vision"
  | "longcontext"
  | "uncensored"
  | "general";

export interface ModelChoice {
  primary: string;
  fallback: string;
  label: string;
}

export const ROUTING_TABLE: Record<Category, ModelChoice> = {
  code: {
    primary: "anthropic/claude-sonnet-4.5",
    fallback: "deepseek/deepseek-chat",
    label: "Code",
  },
  reasoning: {
    primary: "deepseek/deepseek-r1",
    fallback: "openai/o3-mini",
    label: "Reasoning",
  },
  creative: {
    primary: "anthropic/claude-opus-4.1",
    fallback: "openai/gpt-4o",
    label: "Creative",
  },
  vision: {
    primary: "google/gemini-2.5-pro",
    fallback: "openai/gpt-4o",
    label: "Vision",
  },
  longcontext: {
    primary: "google/gemini-2.5-pro",
    fallback: "anthropic/claude-sonnet-4.5",
    label: "Long context",
  },
  uncensored: {
    primary: "nousresearch/hermes-3-llama-3.1-405b",
    fallback: "cognitivecomputations/dolphin-mixtral-8x22b",
    label: "Uncensored",
  },
  general: {
    primary: "google/gemini-2.5-flash",
    fallback: "anthropic/claude-haiku-4.5",
    label: "General",
  },
};

// Full menu offered to the manual model picker. Add/remove freely.
export const MANUAL_MODELS: { value: string; label: string; category: Category }[] = [
  { value: "auto", label: "Auto (classifier picks)", category: "general" },
  { value: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1", category: "creative" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", category: "code" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", category: "general" },
  { value: "openai/gpt-4o", label: "GPT-4o", category: "vision" },
  { value: "openai/o3-mini", label: "o3-mini", category: "reasoning" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", category: "longcontext" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", category: "general" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1", category: "reasoning" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek V3", category: "code" },
  { value: "nousresearch/hermes-3-llama-3.1-405b", label: "Hermes 3 405B (uncensored)", category: "uncensored" },
  { value: "cognitivecomputations/dolphin-mixtral-8x22b", label: "Dolphin Mixtral (uncensored)", category: "uncensored" },
];

export function modelForCategory(category: Category, useFallback = false): string {
  const m = ROUTING_TABLE[category] ?? ROUTING_TABLE.general;
  return useFallback ? m.fallback : m.primary;
}
