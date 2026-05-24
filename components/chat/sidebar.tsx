"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MessageSquare,
  Trash2,
  FileText,
  LogOut,
  Brain,
  Sparkles,
  X,
} from "lucide-react";
import { truncate } from "@/lib/utils";

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onOpenDocs: () => void;
  onOpenMemory: () => void;
  memoryCount?: number;
}

export function Sidebar({
  open,
  activeId,
  onSelect,
  onNew,
  onClose,
  onOpenDocs,
  onOpenMemory,
  memoryCount,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const { conversations } = await res.json();
      setConversations(conversations ?? []);
    }
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("focus", refresh);
    window.addEventListener("conv:refresh", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("conv:refresh", refresh);
    };
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this conversation?")) return;
    setDeleting(id);
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
    if (activeId === id) onNew();
  }

  // Group conversations by date
  function getDateLabel(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days < 1) return "Today";
    if (days < 2) return "Yesterday";
    if (days < 7) return "This week";
    if (days < 30) return "This month";
    return "Older";
  }

  const grouped = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    const label = getDateLabel(c.updated_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(c);
    return acc;
  }, {});

  const groupOrder = ["Today", "Yesterday", "This week", "This month", "Older"];

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        w-72 bg-card border-r border-border
        transition-transform duration-300 ease-in-out will-change-transform
        md:relative md:translate-x-0 md:z-auto
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Omniscient</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3 py-2.5 shrink-0">
        <Button
          onClick={onNew}
          className="w-full h-9 text-sm font-medium gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/30 shadow-none"
          variant="ghost"
        >
          <Plus className="size-4" />
          New conversation
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 px-2">
        {Object.keys(grouped).length === 0 && (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No conversations yet.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Start a new chat above.</p>
          </div>
        )}

        {groupOrder.map((label) => {
          const items = grouped[label];
          if (!items?.length) return null;
          return (
            <div key={label} className="mb-3">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`
                      group flex items-center justify-between rounded-lg px-2.5 py-2
                      cursor-pointer transition-all duration-150
                      ${activeId === c.id
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className={`size-3.5 shrink-0 transition-colors ${
                        activeId === c.id ? "text-primary" : "opacity-50"
                      }`} />
                      <span className="text-xs truncate leading-snug">
                        {truncate(c.title, 34)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); del(c.id); }}
                      disabled={deleting === c.id}
                      className="shrink-0 ml-1 p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="h-2" />
      </ScrollArea>

      {/* Bottom nav */}
      <div className="px-3 pb-safe pt-2 border-t border-border shrink-0 space-y-0.5">
        <button
          onClick={onOpenMemory}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Brain className="size-3.5 shrink-0" />
          <span>Memory</span>
          {memoryCount !== undefined && memoryCount > 0 && (
            <span className="ml-auto text-[10px] bg-primary/15 text-primary border border-primary/20 rounded-full px-1.5 py-0.5 font-medium">
              {memoryCount}
            </span>
          )}
        </button>
        <button
          onClick={onOpenDocs}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <FileText className="size-3.5 shrink-0" />
          <span>Documents</span>
        </button>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="size-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
