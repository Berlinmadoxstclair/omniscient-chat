"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatSurface } from "@/components/chat/chat-surface";
import { DocumentsPanel } from "@/components/chat/documents-panel";
import { MemoryPanel } from "@/components/chat/memory-panel";

export default function HomePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | undefined>(undefined);

  // Fetch memory count for the sidebar badge
  async function refreshMemoryCount() {
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const { memories } = await res.json();
        setMemoryCount((memories ?? []).length);
      }
    } catch {
      // Non-fatal
    }
  }

  useEffect(() => {
    refreshMemoryCount();
    // Refresh after the panel closes (user may have deleted/added)
    if (!memoryOpen) refreshMemoryCount();
  }, [memoryOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        onNew={() => setActiveId(null)}
        onOpenDocs={() => setDocsOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
        memoryCount={memoryCount}
      />
      <ChatSurface
        conversationId={activeId}
        onConversationCreated={setActiveId}
        onMemoryUpdated={refreshMemoryCount}
      />
      <DocumentsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
    </div>
  );
}
