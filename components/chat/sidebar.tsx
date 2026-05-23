"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, FileText, LogOut, Sparkles, Brain } from "lucide-react";
import { truncate } from "@/lib/utils";

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface UserDoc {
  id: string;
  filename: string;
  status: string;
}

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  onOpenDocs,
  onOpenMemory,
  memoryCount,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenDocs: () => void;
  onOpenMemory: () => void;
  memoryCount?: number;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  async function load() {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const { conversations } = await res.json();
      setConversations(conversations ?? []);
    }
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("conv:refresh", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("conv:refresh", onFocus);
    };
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this chat?")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    load();
    if (activeId === id) onNew();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border flex flex-col h-screen bg-card/30">
      <div className="p-3 flex items-center gap-2 border-b border-border">
        <Sparkles className="size-4" />
        <span className="font-semibold text-sm">Omniscient</span>
      </div>
      <div className="p-2">
        <Button size="sm" className="w-full" onClick={onNew}>
          <Plus className="size-4" /> New chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent ${
                activeId === c.id ? "bg-accent" : ""
              }`}
              onClick={() => onSelect(c.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{truncate(c.title, 32)}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  del(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {!conversations.length && (
            <p className="text-xs text-muted-foreground px-2 py-4">No chats yet.</p>
          )}
        </div>
      </ScrollArea>
      <div className="p-2 border-t border-border flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onOpenMemory}
        >
          <Brain className="size-3.5" />
          Memory
          {memoryCount !== undefined && memoryCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 h-4">
              {memoryCount}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={onOpenDocs}>
          <FileText className="size-3.5" /> Documents
        </Button>
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground"
          >
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
