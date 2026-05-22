"use client";

import { useState } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatSurface } from "@/components/chat/chat-surface";
import { DocumentsPanel } from "@/components/chat/documents-panel";

export default function HomePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        onNew={() => setActiveId(null)}
        onOpenDocs={() => setDocsOpen(true)}
      />
      <ChatSurface conversationId={activeId} onConversationCreated={setActiveId} />
      <DocumentsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
    </div>
  );
}
