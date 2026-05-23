import { createClient } from "@/lib/supabase/server";
import { listMemories, storeMemories } from "@/lib/memory";
import type { MemoryCategory } from "@/lib/memory";

/** GET /api/memories — list all memories for the authenticated user */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const memories = await listMemories(user.id);
  return Response.json({ memories });
}

/** POST /api/memories — manually create a memory */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const { content, category, importance } = (await req.json()) as {
    content: string;
    category?: MemoryCategory;
    importance?: number;
  };

  if (!content?.trim()) {
    return new Response(JSON.stringify({ error: "content is required" }), { status: 400 });
  }

  const stored = await storeMemories(user.id, [
    {
      content: content.trim(),
      category: category ?? "fact",
      importance: importance ?? 0.7,
    },
  ]);

  return Response.json({ stored });
}
