import { createClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/memory";
import type { MemoryCategory } from "@/lib/memory";

interface Params {
  params: { id: string };
}

/** PATCH /api/memories/:id — update content, category, importance, or confirmed flag */
export async function PATCH(req: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const body = (await req.json()) as {
    content?: string;
    category?: MemoryCategory;
    importance?: number;
    confirmed?: boolean;
  };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.content !== undefined) {
    update.content = body.content.trim();
    // Re-embed on content change so semantic search stays accurate
    try {
      const embedding = await embedText(body.content.trim());
      update.embedding = embedding as unknown as string;
    } catch {
      // Non-fatal — old embedding stays
    }
  }
  if (body.category !== undefined) update.category = body.category;
  if (body.importance !== undefined) update.importance = body.importance;
  if (body.confirmed !== undefined) update.confirmed = body.confirmed;

  const { error } = await supabase
    .from("memories")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id); // RLS double-check

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return Response.json({ ok: true });
}

/** DELETE /api/memories/:id — permanently remove a memory */
export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const { error } = await supabase
    .from("memories")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return Response.json({ ok: true });
}
