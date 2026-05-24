"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { X, Upload, FileText, Trash2, File } from "lucide-react";

interface Doc {
  id: string;
  filename: string;
  status: string;
  byte_size: number;
  created_at: string;
}

export function DocumentsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/documents");
    if (r.ok) setDocs((await r.json()).documents ?? []);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: "Upload failed" }));
      setErr(error);
    }
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-screen w-[420px] max-w-full z-50 flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="font-semibold text-sm">Documents</span>
            {docs.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {docs.length}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Upload */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.csv,.json,text/*"
            className="hidden"
            onChange={onUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
              text-sm font-medium transition-all
              ${uploading
                ? "border-primary/30 text-primary/60 bg-primary/5 cursor-wait"
                : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer"
              }
            `}
          >
            <Upload className={`size-4 ${uploading ? "animate-bounce" : ""}`} />
            {uploading ? "Uploading & embedding…" : "Upload PDF or text file"}
          </button>
          {err && (
            <p className="text-xs text-destructive mt-2 px-1">{err}</p>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <File className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No documents yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                Uploaded files are embedded and become searchable in chat.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div className="shrink-0 size-8 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(d.byte_size)} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={d.status === "ready" ? "secondary" : "outline"}
                      className={`text-[10px] px-1.5 ${
                        d.status === "failed"
                          ? "border-destructive/50 text-destructive"
                          : d.status === "ready"
                          ? "text-green-400 bg-green-400/10 border-green-400/20"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d.status}
                    </Badge>
                    <button
                      onClick={() => del(d.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Supported: PDF, TXT, MD, CSV, JSON. Files are chunked and embedded with pgvector for semantic retrieval.
          </p>
        </div>
      </aside>
    </>
  );
}
