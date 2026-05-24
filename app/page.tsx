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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | undefined>(undefined);

  async function refreshMemoryCount() {
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const { memories } = await res.json();
        setMemoryCount((memories ?? []).length);
      }
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    refreshMemoryCount();
  }, []);

  useEffect(() => {
    if (!memoryOpen) refreshMemoryCount();
  }, [memoryOpen]);

  // Close sidebar on conversation select (mobile UX)
  function handleSelect(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function handleNew() {
    setActiveId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onClose={() => setSidebarOpen(false)}
        onOpenDocs={() => { setDocsOpen(true); setSidebarOpen(false); }}
        onOpenMemory={() => { setMemoryOpen(true); setSidebarOpen(false); }}
        memoryCount={memoryCount}
      />

      <ChatSurface
        conversationId={activeId}
        onConversationCreated={setActiveId}
        onMemoryUpdated={refreshMemoryCount}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <DocumentsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
    </div>
  );
}
