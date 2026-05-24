"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "ai/react";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "./markdown";
import { ModelPicker } from "./model-picker";
import {
  Sparkles,
  Send,
  StopCircle,
  Menu,
  PenLine,
  Brain,
  FileText,
  ArrowDown,
  Loader2,
} from "lucide-react";

interface Props {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onMemoryUpdated?: () => void;
  onOpenSidebar: () => void;
}

interface AssistantMeta {
  model: string;
  category: string;
  auto: boolean;
  memoryCount: number;
  writerMode: boolean;
}

export function ChatSurface({
  conversationId,
  onConversationCreated,
  onMemoryUpdated,
  onOpenSidebar,
}: Props) {
  const [modelOverride, setModelOverride] = useState("auto");
  const [useRag, setUseRag] = useState(true);
  const [writerMode, setWriterMode] = useState(false);
  const [lastMeta, setLastMeta] = useState<AssistantMeta | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages } =
    useChat({
      api: "/api/chat",
      onResponse(res) {
        const id = res.headers.get("X-Conversation-Id");
        const model = res.headers.get("X-Model") ?? "";
        const category = res.headers.get("X-Category") ?? "general";
        const auto = res.headers.get("X-Auto") === "1";
        const memoryCount = parseInt(res.headers.get("X-Memory-Count") ?? "0", 10);
        const writerMode = res.headers.get("X-Writer-Mode") === "1";
        setLastMeta({ model, category, auto, memoryCount, writerMode });
        if (id && id !== conversationId) {
          onConversationCreated(id);
          window.dispatchEvent(new Event("conv:refresh"));
        }
      },
      onFinish() {
        onMemoryUpdated?.();
        scrollToBottom();
      },
    });

  function scrollToBottom(smooth = true) {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  // Show scroll-to-bottom button when not at bottom
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }

  function submit() {
    if (!input.trim() || isLoading) return;
    handleSubmit(undefined, {
      body: { conversationId, modelOverride, useRag, writerMode },
    });
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // Load history when conversation switches
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
          (hist ?? []).map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
        setTimeout(() => scrollToBottom(false), 50);
      }
    })();
  }, [conversationId, setMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) scrollToBottom();
  }, [messages]);

  // Auto-grow textarea
  const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, []);

  function onTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    handleInputChange(e);
    autoGrow(e.target);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-[100dvh] relative">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-3 py-2.5 border-b border-border bg-background/80 backdrop-blur-md z-10">
        {/* Hamburger (mobile) */}
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        >
          <Menu className="size-4.5" />
        </button>

        {/* Conversation info / status */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          {lastMeta ? (
            <>
              {lastMeta.writerMode ? (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-violet-400">
                  <PenLine className="size-3" />
                  Writer Mode
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {lastMeta.auto ? "auto · " : ""}
                  <span className="font-medium text-foreground/70">{lastMeta.category}</span>
                </span>
              )}
              <span className="hidden sm:block text-[11px] text-muted-foreground/50 truncate">
                {lastMeta.model}
              </span>
              {lastMeta.memoryCount > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5 shrink-0"
                  title={`${lastMeta.memoryCount} memories active`}
                >
                  <Brain className="size-2.5" />
                  {lastMeta.memoryCount}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="size-3 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground/60 hidden sm:block">
                Omniscient
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center pb-24">
            {writerMode ? (
              <>
                <div className="size-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                  <PenLine className="size-6 text-violet-400" />
                </div>
                <h2 className="text-base font-semibold text-violet-300 mb-1">Writer Mode</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Give me a concept, a title, a feeling, a first line.
                  Songs, novels, fiction, non-fiction — I&apos;ll build from what you bring.
                </p>
              </>
            ) : (
              <>
                <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <h2 className="text-base font-semibold mb-1">What&apos;s on your mind?</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  The right model is chosen automatically for every message — or pin one yourself.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="py-6 px-4 space-y-6 max-w-3xl mx-auto pb-4">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLast = i === messages.length - 1;
              const content = typeof m.content === "string" ? m.content : "";

              return (
                <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {/* Assistant avatar */}
                  {!isUser && (
                    <div className="shrink-0 mt-0.5 size-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                      <Sparkles className="size-3.5 text-primary" />
                    </div>
                  )}

                  <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[78%]`}>
                    {/* Message bubble */}
                    {isUser ? (
                      <div className="rounded-2xl rounded-tr-sm bg-secondary border border-border/60 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {content}
                      </div>
                    ) : (
                      <div className="text-foreground/90">
                        <Markdown>{content}</Markdown>
                      </div>
                    )}

                    {/* Meta on last assistant message */}
                    {!isUser && isLast && lastMeta && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50 truncate max-w-[200px]">
                          {lastMeta.model}
                        </span>
                        {lastMeta.memoryCount > 0 && (
                          <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                            <Brain className="size-2.5" />{lastMeta.memoryCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="shrink-0 mt-0.5 size-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div className="h-1" />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-28 right-4 size-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:border-border/80 z-10"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      {/* ── Composer ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-md px-3 pt-2.5 pb-safe z-10">

        {/* Mode pills */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* Writer toggle */}
          <button
            type="button"
            onClick={() => setWriterMode((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all select-none ${
              writerMode
                ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <PenLine className="size-3" />
            Writer
          </button>

          {!writerMode && (
            <>
              {/* RAG toggle */}
              <button
                type="button"
                onClick={() => setUseRag((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all select-none ${
                  useRag
                    ? "bg-primary/10 border-primary/25 text-primary/80"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3" />
                RAG
              </button>

              {/* Model picker */}
              <div className="flex-1 min-w-0 flex justify-end">
                <ModelPicker value={modelOverride} onChange={setModelOverride} />
              </div>
            </>
          )}

          {writerMode && (
            <span className="text-[10px] text-violet-400/60 ml-1">
              Claude Opus · max creativity
            </span>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={onTextareaChange}
            onKeyDown={onKeyDown}
            placeholder={writerMode
              ? "Give me a concept, title, feeling, or first line…"
              : "Message Omniscient…"
            }
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-[180px] rounded-xl border-border/60 bg-card text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/40 transition-all placeholder:text-muted-foreground/50 py-3 px-3.5"
          />

          {/* Send / stop button */}
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="shrink-0 size-11 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 flex items-center justify-center transition-all"
            >
              <StopCircle className="size-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              className={`shrink-0 size-11 rounded-xl flex items-center justify-center transition-all ${
                input.trim()
                  ? writerMode
                    ? "bg-violet-500/90 hover:bg-violet-500 text-white border border-violet-400/30 shadow-sm"
                    : "bg-primary/90 hover:bg-primary text-primary-foreground border border-primary/30 shadow-sm"
                  : "bg-muted border border-border text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <Loader2 className="size-4.5 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/30 mt-2 mb-0.5 hidden sm:block">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
