/**
 * lib/memory.ts
 * Core memory operations: embed, retrieve, store (with dedup), format for prompt.
 * All DB calls use the service-role client so they work from API routes.
 */
import OpenAI from "openai";
import { createServiceClient } from "./supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

/** Similarity threshold above which two memories are considered duplicates */
const DEDUP_THRESHOLD = 0.92;

/** Max memories injected into system prompt (pinned + retrieved combined) */
const MAX_PROMPT_MEMORIES = 24;

// ------------------------------------------------------------------ types
export type MemoryCategory =
  | "personal"
  | "preference"
  | "project"
  | "skill"
  | "relationship"
  | "goal"
  | "habit"
  | "fact";

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  source_conversation_id: string | null;
  access_count: number;
  last_accessed_at: string | null;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  category: string;
  importance: number;
  similarity: number;
}

export interface ExtractedFact {
  content: string;
  category: MemoryCategory;
  importance: number; // 0–1
}

// ------------------------------------------------------------------ embeddings
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8192),
  });
  return res.data[0].embedding;
}

// ------------------------------------------------------------------ retrieval

/**
 * Semantic search: returns memories most relevant to `query`.
 * Also bumps last_accessed_at for returned rows (fire-and-forget).
 */
export async function retrieveMemories(
  userId: string,
  query: string,
  k = 10,
  threshold = 0.65,
): Promise<RetrievedMemory[]> {
  try {
    const embedding = await embedText(query);
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding as unknown as string,
      match_count: k,
      filter_user_id: userId,
      similarity_threshold: threshold,
    });

    if (error || !data) return [];

    // Fire-and-forget access tracking
    const ids = (data as RetrievedMemory[]).map((m) => m.id);
    if (ids.length) {
      supabase
        .from("memories")
        .update({ last_accessed_at: new Date().toISOString() })
        .in("id", ids)
        .then(() => {});
    }

    return data as RetrievedMemory[];
  } catch {
    return [];
  }
}

/**
 * Returns high-importance memories (importance ≥ 0.8) that are always
 * injected into the system prompt regardless of the query topic.
 */
export async function getPinnedMemories(userId: string): Promise<Memory[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .gte("importance", 0.8)
      .order("importance", { ascending: false })
      .limit(15);
    return (data as Memory[]) ?? [];
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ storage

/**
 * Stores extracted facts for a user with deduplication:
 * - If a near-duplicate exists (cosine ≥ DEDUP_THRESHOLD), updates it if the
 *   new fact is more detailed; otherwise skips.
 * - Inserts fresh otherwise.
 * Returns the count of newly-inserted memories.
 */
export async function storeMemories(
  userId: string,
  facts: ExtractedFact[],
  sourceConversationId?: string,
): Promise<number> {
  if (!facts.length) return 0;
  const supabase = createServiceClient();
  let inserted = 0;

  for (const fact of facts) {
    try {
      const embedding = await embedText(fact.content);

      // Check for near-duplicates
      const { data: similar } = await supabase.rpc("match_memories", {
        query_embedding: embedding as unknown as string,
        match_count: 1,
        filter_user_id: userId,
        similarity_threshold: DEDUP_THRESHOLD,
      });

      if (similar && similar.length > 0) {
        const existing = similar[0] as RetrievedMemory;
        // Only overwrite if new version is meaningfully longer / more detailed
        if (fact.content.length > existing.content.length + 20) {
          await supabase
            .from("memories")
            .update({
              content: fact.content,
              importance: Math.max(fact.importance, existing.importance),
              embedding: embedding as unknown as string,
              updated_at: new Date().toISOString(),
              source_conversation_id: sourceConversationId ?? null,
            })
            .eq("id", existing.id)
            .eq("user_id", userId);
        }
        continue; // don't insert a duplicate
      }

      // Fresh fact — insert
      await supabase.from("memories").insert({
        user_id: userId,
        content: fact.content,
        category: fact.category,
        importance: fact.importance,
        embedding: embedding as unknown as string,
        source_conversation_id: sourceConversationId ?? null,
        confirmed: false,
      });
      inserted++;
    } catch {
      // Non-fatal — move to next fact
    }
  }

  return inserted;
}

// ------------------------------------------------------------------ prompt formatting

/**
 * Merges pinned + semantically-retrieved memories (deduplicated by id)
 * and formats them as a <memory> block for the system prompt.
 */
export function formatMemoriesForPrompt(
  pinned: Memory[],
  retrieved: RetrievedMemory[],
): string {
  const seen = new Set<string>();
  const all: Array<{ content: string; category: string }> = [];

  for (const m of pinned) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      all.push({ content: m.content, category: m.category });
    }
  }
  for (const m of retrieved) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      all.push({ content: m.content, category: m.category });
    }
  }

  if (!all.length) return "";

  const capped = all.slice(0, MAX_PROMPT_MEMORIES);
  const lines = capped.map((m) => `  [${m.category}] ${m.content}`);

  return (
    `\n\n<memory>\n` +
    `You have persistent memory of this user. Incorporate these facts naturally — ` +
    `do NOT recite them back or mention that you "remember" unless directly asked.\n` +
    lines.join("\n") +
    `\n</memory>`
  );
}

// ------------------------------------------------------------------ management

/** Full memory list for the UI, ordered by importance then recency. */
export async function listMemories(userId: string): Promise<Memory[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false });
    return (data as Memory[]) ?? [];
  } catch {
    return [];
  }
}

/** Count of memories — used for the UI badge. */
export async function countMemories(userId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    return count ?? 0;
  } catch {
    return 0;
  }
}
