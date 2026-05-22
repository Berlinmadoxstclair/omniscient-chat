"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Upload, FileText, Trash2 } from "lucide-react";

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4" />
            <h2 className="text-sm font-semibold">Documents (RAG)</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <label className="block">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,.csv,.json,text/*"
              className="hidden"
              onChange={onUpload}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "Uploading & embedding..." : "Upload PDF or text"}
            </Button>
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="max-h-72 overflow-auto space-y-1">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.filename}</div>
                  <div className="text-muted-foreground">
                    {(d.byte_size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={d.status === "ready" ? "secondary" : "outline"}
                    className={d.status === "failed" ? "border-destructive text-destructive" : ""}
                  >
                    {d.status}
                  </Badge>
                  <button onClick={() => del(d.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!docs.length && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No documents yet. Uploaded files are embedded and become retrievable in chat.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
