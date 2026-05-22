import { createOpenAI } from "@ai-sdk/openai";

// OpenRouter is OpenAI-API compatible. Reuse the @ai-sdk/openai adapter.
export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": "Omniscient Chat",
  },
});
