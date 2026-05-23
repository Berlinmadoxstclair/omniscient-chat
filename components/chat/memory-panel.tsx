"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Plus,
  Trash2,
  Check,
  Pencil,
  Brain,
  Search,
  Star,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Memory, MemoryCategory } from "@/lib/memory";

// ------------------------------------------------------------------ constants

const CATEGORY_META: Record<
  MemoryCategory,
  { label: string; color: string; emoji: string }
> = {
  personal:     { label: "Personal",     color: "bg-blue-500/15 text-blue-400 border-blue-500/20",     emoji: "👤" },
  preference:   { label: "Preference",   color: "bg-purple-500/15 text-purple-400 border-purple-500/20", emoji: "⚙️" },
  project:      { label: "Project",      color: "bg-green-500/15 text-green-400 border-green-500/20",   emoji: "🚀" },
  skill:        { label: "Skill",        color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", emoji: "🧠" },
  relationship: { label: "Relationship", color: "bg-pink-500/15 text-pink-400 border-pink-500/20",     emoji: "👥" },
  goal:         { label: "Goal",         color: "bg-orange-500/15 text-orange-400 border-orange-500/20", emoji: "🎯" },
  habit:        { label: "Habit",        color: "bg-teal-500/15 text-teal-400 border-teal-500/20",     emoji: "🔄" },
  fact:         { label: "Fact",         color: "bg-slate-500/15 text-slate-400 border-slate-500/20",  emoji: "📌" },
};

const ORDERED_CATEGORIES: MemoryCategory[] = [
  "personal", "preference", "project", "skill", "relationship", "goal", "habit", "fact",
];

// ------------------------------------------------------------------ helpers

function ImportanceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <span className="flex gap-0.5" title={`Importance: ${Math.round(value * 100)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < filled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ row component

function MemoryRow({
  memory,
  onDelete,
  onUpdate,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Memory>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = CATEGORY_META[memory.category] ?? CATEGORY_META.fact;

  function startEdit() {
    setDraft(memory.content);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function saveEdit() {
    if (!draft.trim() || draft === memory.content) {
      setEditing(false);
      return;
    }
    onUpdate(memory.id, { content: draft.trim() });
    setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <div className="group flex items-start gap-2 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors">
      {/* Importance dots */}
      <div className="mt-1 shrink-0">
        <ImportanceDots value={memory.importance} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={saveEdit}
            className="h-7 text-sm"
          />
        ) : (
          <p className="text-sm leading-snug text-foreground/90 break-words">
            {memory.content}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {memory.confirmed && (
            <span className="text-[9px] text-green-400 flex items-center gap-0.5">
              <Check className="size-2.5" /> verified
            </span>
          )}
          <span className="text-[9px] text-muted-foreground">
            {new Date(memory.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onUpdate(memory.id, { confirmed: !memory.confirmed })}
          title={memory.confirmed ? "Unverify" : "Mark as verified"}
          className={`p-1 rounded hover:bg-accent ${
            memory.confirmed ? "text-green-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Check className="size-3" />
        </button>
        <button
          onClick={startEdit}
          title="Edit"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Pencil className="size-3" />
        </button>
        <button
          onClick={() => onDelete(memory.id)}
          title="Delete"
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ main panel

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MemoryPanel({ open, onClose }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<MemoryCategory>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("fact");
  const [newImportance, setNewImportance] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const { memories } = await res.json();
        setMemories(memories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (adding) setTimeout(() => addInputRef.current?.focus(), 0);
  }, [adding]);

  // ---- filter
  const filtered = search.trim()
    ? memories.filter((m) =>
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase()),
      )
    : memories;

  // ---- group by category
  const grouped = ORDERED_CATEGORIES.reduce<Record<MemoryCategory, Memory[]>>(
    (acc, cat) => {
      acc[cat] = filtered.filter((m) => m.category === cat);
      return acc;
    },
    {} as Record<MemoryCategory, Memory[]>,
  );

  const totalCount = memories.length;

  // ---- mutations
  async function handleDelete(id: string) {
    if (!confirm("Delete this memory permanently?")) return;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
  }

  async function handleUpdate(id: string, patch: Partial<Memory>) {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent.trim(),
          category: newCategory,
          importance: newImportance,
        }),
      });
      if (res.ok) {
        setNewContent("");
        setAdding(false);
        load(); // refresh
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleCollapse(cat: MemoryCategory) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-screen w-[420px] max-w-full z-50 flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <span className="font-semibold text-sm">Memory</span>
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {totalCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => setAdding((v) => !v)}
            >
              <Plus className="size-3" /> Add
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Add memory form */}
        {adding && (
          <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2">
            <Input
              ref={addInputRef}
              placeholder="e.g. User prefers TypeScript over JavaScript"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ORDERED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Star className="size-3 text-muted-foreground" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newImportance}
                  onChange={(e) => setNewImportance(Number(e.target.value))}
                  className="w-20 accent-primary"
                  title={`Importance: ${Math.round(newImportance * 100)}%`}
                />
                <span className="text-[10px] text-muted-foreground w-7">
                  {Math.round(newImportance * 100)}%
                </span>
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving || !newContent.trim()}>
                {saving ? "…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search memories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Memory list */}
        <ScrollArea className="flex-1 px-2 py-2">
          {loading && (
            <p className="text-center text-xs text-muted-foreground py-8">Loading…</p>
          )}

          {!loading && totalCount === 0 && (
            <div className="text-center py-16 space-y-2">
              <Brain className="mx-auto size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No memories yet.</p>
              <p className="text-xs text-muted-foreground/60 max-w-[240px] mx-auto">
                As you chat, Omniscient will automatically extract and remember
                things about you.
              </p>
            </div>
          )}

          {!loading && totalCount > 0 && filtered.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              No memories match &ldquo;{search}&rdquo;
            </p>
          )}

          <div className="space-y-1">
            {ORDERED_CATEGORIES.map((cat) => {
              const items = grouped[cat];
              if (!items.length) return null;
              const meta = CATEGORY_META[cat];
              const isCollapsed = collapsed.has(cat);

              return (
                <div key={cat} className="mb-1">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCollapse(cat)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3 text-muted-foreground" />
                    )}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.emoji} {meta.label}
                    </span>
                    <span
                      className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${meta.color}`}
                    >
                      {items.length}
                    </span>
                  </button>

                  {/* Rows */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 ml-2">
                      {items.map((m) => (
                        <MemoryRow
                          key={m.id}
                          memory={m}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Memories are extracted automatically after each response and injected
            into every new conversation.
          </p>
        </div>
      </aside>
    </>
  );
}
