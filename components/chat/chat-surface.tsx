"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ModelPicker } from "./model-picker";
import { Markdown } from "./markdown";
import { Sparkles, Send, StopCircle, FileText } from "lucide-react";

interface Props {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

interface AssistantMeta {
  model: string;
  category: string;
  auto: boolean;
}

export function ChatSurface({ conversationId, onConversationCreated }: Props) {
  const [modelOverride, setModelOverride] = useState("auto");
  const [useRag, setUseRag] = useState(true);
  const [lastMeta, setLastMeta] = useState<AssistantMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages } =
    useChat({
      api: "/api/chat",
      onResponse(res) {
        const id = res.headers.get("X-Conversation-Id");
        const model = res.headers.get("X-Model") ?? "";
        const category = res.headers.get("X-Category") ?? "general";
        const auto = res.headers.get("X-Auto") === "1";
        setLastMeta({ model, category, auto });
        if (id && id !== conversationId) {
          onConversationCreated(id);
          window.dispatchEvent(new Event("conv:refresh"));
        }
      },
    });

  function submit() {
    if (!input.trim()) return;
    handleSubmit(undefined, {
      body: { conversationId, modelOverride, useRag },
    });
  }

  // Load history when switching conversations
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLastMeta(null);
      return;
    }
    (async () => {
      const r = await fetch(`/api/conversations/${conversationId}`);
      if (r.ok) {
        const { messages: hist } = await r.json();
        setMessages(
          (hist ?? []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      }
    })();
  }, [conversationId, setMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-screen flex-1 min-w-0">
      {/* Toolbar */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {lastMeta && (
            <>
              <Badge variant="secondary">
                {lastMeta.auto ? "auto • " : ""}
                {lastMeta.category}
              </Badge>
              <span className="text-[11px] text-muted-foreground truncate">{lastMeta.model}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={useRag}
              onChange={(e) => setUseRag(e.target.checked)}
              className="accent-primary"
            />
            <FileText className="size-3" /> RAG
          </label>
          <ModelPicker value={modelOverride} onChange={setModelOverride} />
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              <Sparkles className="mx-auto size-6 mb-2" />
              <p className="text-sm">
                Ask anything. The classifier picks the best model per turn, or pin one above.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className={m.role === "user" ? "text-foreground/90" : ""}>
                {m.role === "assistant" ? (
                  <Markdown>{typeof m.content === "string" ? m.content : ""}</Markdown>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {typeof m.content === "string" ? m.content : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mx-auto max-w-3xl"
        >
          <div className="relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Message Omniscient..."
              className="min-h-[60px] pr-24"
              rows={2}
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              {isLoading ? (
                <Button type="button" size="sm" variant="ghost" onClick={stop}>
                  <StopCircle className="size-4" />
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!input.trim()}>
                  <Send className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
