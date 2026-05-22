import OpenAI from "openai";
import { createServiceClient } from "./supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

// ----- Chunking -----
// Naive but solid: ~800-token windows w/ 100-token overlap. Tokens estimated at 4 chars.
const CHUNK_CHARS = 3200;
const OVERLAP_CHARS = 400;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK_CHARS) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_CHARS, clean.length);
    chunks.push(clean.slice(i, end));
    if (end >= clean.length) break;
    i = end - OVERLAP_CHARS;
  }
  return chunks;
}

// ----- Embeddings -----
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

// ----- Retrieval (top-k cosine) -----
export interface RetrievedChunk {
  document_id: string;
  content: string;
  similarity: number;
}

export async function retrieve(
  userId: string,
  query: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  const [embedding] = await embed([query]);
  if (!embedding) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding as unknown as string,
    match_count: k,
    filter_user_id: userId,
  });

  if (error || !data) return [];
  return data as RetrievedChunk[];
}

// ----- Ingest a single document -----
export async function ingestDocument(opts: {
  userId: string;
  documentId: string;
  text: string;
}) {
  const supabase = createServiceClient();
  const chunks = chunkText(opts.text);

  if (chunks.length === 0) {
    await supabase
      .from("documents")
      .update({ status: "failed", error: "No text extracted" })
      .eq("id", opts.documentId);
    return;
  }

  // Batch embeddings — OpenAI accepts up to 2048 inputs per call.
  const BATCH = 64;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embed(slice);

    const rows = slice.map((content, j) => ({
      document_id: opts.documentId,
      user_id: opts.userId,
      chunk_index: i + j,
      content,
      embedding: vectors[j] as unknown as string,
    }));

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) {
      await supabase
        .from("documents")
        .update({ status: "failed", error: error.message })
        .eq("id", opts.documentId);
      return;
    }
  }

  await supabase.from("documents").update({ status: "ready" }).eq("id", opts.documentId);
}
