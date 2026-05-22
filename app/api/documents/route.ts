import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/documents -> list user's docs
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, mime_type, byte_size, status, error, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

// POST /api/documents (multipart) -> upload + ingest
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  // Extract text
  let text = "";
  const mime = file.type;
  try {
    if (mime === "application/pdf") {
      const buf = Buffer.from(await file.arrayBuffer());
      // Lazy import — pdf-parse is heavy
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buf);
      text = parsed.text;
    } else if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml" ||
      file.name.match(/\.(md|markdown|txt|csv|json|xml|html?)$/i)
    ) {
      text = await file.text();
    } else {
      return NextResponse.json(
        { error: `Unsupported type: ${mime}. Use PDF or text.` },
        { status: 400 },
      );
    }
  } catch (err) {
    return NextResponse.json({ error: `extract failed: ${(err as Error).message}` }, { status: 500 });
  }

  // Insert document row
  const { data: doc, error: insErr } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename: file.name,
      mime_type: mime,
      byte_size: file.size,
      status: "processing",
    })
    .select()
    .single();
  if (insErr || !doc) return NextResponse.json({ error: insErr?.message }, { status: 500 });

  // Ingest (in-request — fine for personal use; move to a job queue if you scale)
  try {
    await ingestDocument({ userId: user.id, documentId: doc.id, text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ document: doc });
}
