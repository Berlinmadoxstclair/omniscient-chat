import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "./openrouter";
import { type Category, modelForCategory } from "./models";

const ClassificationSchema = z.object({
  category: z.enum([
    "code",
    "reasoning",
    "creative",
    "vision",
    "longcontext",
    "uncensored",
    "general",
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
});

export interface ClassificationResult {
  category: Category;
  confidence: number;
  reasoning: string;
  model: string;
  latencyMs: number;
}

const SYSTEM = `You classify the user's request into ONE category to pick the best LLM.

Categories:
- code: programming, debugging, refactoring, system design, devops
- reasoning: math, logic puzzles, multi-step research analysis
- creative: writing, brainstorming, fiction, lyrics, copy
- vision: explicitly references an attached image
- longcontext: analyze/summarize a large pasted doc (>2k chars of source text)
- uncensored: explicit / NSFW / content mainstream models refuse on policy
- general: factual Q&A, casual chat, anything else

Be biased toward "general" when unsure. Use "uncensored" only when content is clearly going to be refused by mainstream models.`;

export async function classify(
  userMessage: string,
  hasImage = false,
): Promise<ClassificationResult> {
  const t0 = Date.now();

  // Image attached? Vision path short-circuits the classifier.
  if (hasImage) {
    return {
      category: "vision",
      confidence: 1,
      reasoning: "Image attached",
      model: modelForCategory("vision"),
      latencyMs: 0,
    };
  }

  // Truncate to keep classifier cheap & fast.
  const sample = userMessage.length > 1500 ? userMessage.slice(0, 1500) + "..." : userMessage;
  const isLong = userMessage.length > 2000;

  try {
    const { object } = await generateObject({
      model: openrouter(process.env.CLASSIFIER_MODEL ?? "google/gemini-2.5-flash"),
      schema: ClassificationSchema,
      system: SYSTEM,
      prompt: `Message:\n"""\n${sample}\n"""\n\nClassify.`,
      temperature: 0,
    });

    const category: Category = isLong && object.category === "general" ? "longcontext" : object.category;

    return {
      category,
      confidence: object.confidence,
      reasoning: object.reasoning,
      model: modelForCategory(category),
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    // Classifier failed - fall back to general so the user still gets a response.
    return {
      category: "general",
      confidence: 0,
      reasoning: `Classifier error: ${(err as Error).message}`,
      model: modelForCategory("general"),
      latencyMs: Date.now() - t0,
    };
  }
}
