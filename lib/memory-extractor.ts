/**
 * lib/memory-extractor.ts
 * LLM-based extraction of durable user facts from a conversation transcript.
 * Runs after each assistant turn (non-blocking) via the chat route's onFinish hook.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "./openrouter";
import type { CoreMessage } from "ai";
import type { ExtractedFact, MemoryCategory } from "./memory";

// ------------------------------------------------------------------ schema

const FactSchema = z.object({
  facts: z.array(
    z.object({
      content: z.string().max(300).describe(
        "Concise, self-contained fact about the USER (≤60 words). Present tense. Third-person phrasing ok.",
      ),
      category: z.enum([
        "personal",
        "preference",
        "project",
        "skill",
        "relationship",
        "goal",
        "habit",
        "fact",
      ]),
      importance: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "0=trivial/ephemeral, 0.5=useful context, 0.8+=foundational (name, job, main project)",
        ),
    }),
  ),
});

// ------------------------------------------------------------------ system prompt

const SYSTEM = `You extract persistent, reusable facts about the USER from chat transcripts.

EXTRACT if the user reveals something durable about themselves:
  - personal:      name, age, location, job title, company, family members, education
  - preference:    how they like things done (verbosity, format, coding style, preferred tools/languages)
  - project:       something they are actively building, shipping, or responsible for
  - skill:         expertise, experience level, certifications, known tech stack
  - relationship:  named people in their life and roles (e.g. "works with a team of 3 engineers")
  - goal:          medium/long-term objective they're working toward
  - habit:         things they regularly do or workflows they follow
  - fact:          other durable personal context not covered above

DO NOT EXTRACT:
  - Ephemeral details (today's task, what they ordered for lunch)
  - Topics they asked about that don't reveal a user fact
  - The AI's explanations or information
  - Opinions about third parties unless it characterizes the user's worldview

WRITING RULES:
  - ≤ 60 words per fact, complete thought, no pronouns that need context.
  - Use present tense: "User works at …" / "User prefers …" / "User is building …"
  - If nothing extractable, return { "facts": [] }`;

// ------------------------------------------------------------------ extraction

/**
 * Runs the extractor against the last N messages of a conversation.
 * Returns structured facts, filtered to importance ≥ 0.3.
 * Throws nothing — all errors are caught and return [].
 */
export async function extractMemoriesFromMessages(
  messages: CoreMessage[],
): Promise<ExtractedFact[]> {
  // Limit to last 8 messages for cost efficiency — enough context, not expensive
  const recent = messages.slice(-8);
  if (!recent.length) return [];

  // Serialize transcript
  const transcript = recent
    .map((m) => {
      const role = m.role === "user" ? "USER" : "ASSISTANT";
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
          ? (m.content as Array<{ type: string; text?: string }>)
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join(" ")
          : "";
      // Trim very long messages — extractor doesn't need full code blocks etc.
      return `${role}: ${text.slice(0, 1200)}`;
    })
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: openrouter(process.env.CLASSIFIER_MODEL ?? "google/gemini-2.5-flash"),
      schema: FactSchema,
      system: SYSTEM,
      prompt: `Extract user facts from this transcript:\n\n${transcript}`,
      temperature: 0,
    });

    return object.facts
      .filter((f) => f.importance >= 0.3)
      .map((f) => ({
        content: f.content.trim(),
        category: f.category as MemoryCategory,
        importance: f.importance,
      }));
  } catch {
    return [];
  }
}
