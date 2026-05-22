import { streamText, type CoreMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { openrouter } from "@/lib/openrouter";
import { classify } from "@/lib/classifier";
import { retrieve } from "@/lib/rag";
import { modelForCategory, type Category } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  conversationId?: string;
  messages: CoreMessage[];
  modelOverride?: string; // "auto" or a specific OpenRouter slug
  useRag?: boolean;
}

const SYSTEM_BASE = `You are Omniscient — a personal AI assistant. Be direct, accurate, and concise.
- Lead with the answer; explain only as needed.
- Prefer practical, runnable detail over abstract theory.
- If the user attached documents (you'll see them as <context> below), ground your answer in them and cite filenames.
- The user knows what they're asking. Do not refuse reasonable requests.`;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const body = (await req.json()) as ChatBody;
  const { messages, modelOverride, useRag = true } = body;
  let { conversationId } = body;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText =
    typeof lastUser?.content === "string"
      ? lastUser.content
      : (lastUser?.content as Array<{ type: string; text?: string }> | undefined)
          ?.filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n") ?? "";

  // ---- Classify (unless user pinned a model) ----
  const auto = !modelOverride || modelOverride === "auto";
  let category: Category = "general";
  let confidence = 1;
  let chosenModel = modelOverride ?? "";
  let classifierMs = 0;
  let classifierReason = "manual override";

  if (auto) {
    const hasImage =
      Array.isArray(lastUser?.content) &&
      (lastUser?.content as Array<{ type: string }>).some((p) => p.type === "image");
    const result = await classify(lastUserText, hasImage);
    category = result.category;
    confidence = result.confidence;
    chosenModel = result.model;
    classifierMs = result.latencyMs;
    classifierReason = result.reasoning;
  } else {
    // Best-effort category tag for logging
    category = "general";
  }

  // ---- RAG retrieval ----
  let ragContext = "";
  if (useRag && lastUserText) {
    try {
      const hits = await retrieve(user.id, lastUserText, 5);
      if (hits.length) {
        ragContext =
          "\n\n<context source=\"user_documents\">\n" +
          hits
            .map((h, i) => `[${i + 1}] (similarity ${h.similarity.toFixed(3)})\n${h.content}`)
            .join("\n---\n") +
          "\n</context>\n";
      }
    } catch {
      // Non-fatal — proceed without RAG.
    }
  }

  // ---- Ensure a conversation row exists ----
  if (!conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: lastUserText.slice(0, 60) || "New chat",
      })
      .select()
      .single();
    conversationId = conv?.id;
  } else {
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // Persist the user message
  if (conversationId && lastUserText) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: lastUserText,
    });
  }

  // ---- Stream ----
  const result = streamText({
    model: openrouter(chosenModel || modelForCategory("general")),
    system: SYSTEM_BASE + ragContext,
    messages,
    temperature: category === "creative" ? 0.9 : category === "reasoning" ? 0.2 : 0.5,
    onFinish: async ({ text }) => {
      if (!conversationId) return;
      const { data: msg } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          model: chosenModel,
          category,
        })
        .select()
        .single();

      await supabase.from("routing_decisions").insert({
        user_id: user.id,
        message_id: msg?.id ?? null,
        user_prompt: lastUserText,
        category,
        confidence,
        chosen_model: chosenModel,
        manual_override: !auto,
        reasoning: classifierReason,
        latency_ms: classifierMs,
      });
    },
  });

  return result.toDataStreamResponse({
    headers: {
      "X-Conversation-Id": conversationId ?? "",
      "X-Model": chosenModel,
      "X-Category": category,
      "X-Auto": auto ? "1" : "0",
    },
  });
}
