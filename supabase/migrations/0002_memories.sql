-- Omniscient Chat — memory system
-- Run in Supabase SQL Editor AFTER 0001_init.sql

-- ============================================================
-- memories: persistent user facts extracted from conversations
-- ============================================================
create table if not exists public.memories (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  content               text not null,
  category              text not null default 'fact'
                          check (category in (
                            'personal','preference','project',
                            'skill','relationship','goal','habit','fact'
                          )),
  importance            numeric not null default 0.5
                          check (importance >= 0 and importance <= 1),
  embedding             vector(1536),
  source_conversation_id uuid references public.conversations(id) on delete set null,
  access_count          integer not null default 0,
  last_accessed_at      timestamptz,
  confirmed             boolean not null default false,   -- user manually verified
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists memories_user_importance_idx
  on public.memories(user_id, importance desc);

create index if not exists memories_user_created_idx
  on public.memories(user_id, created_at desc);

-- IVFFlat index — small list count since we expect ≪ document_chunks volume
create index if not exists memories_embedding_idx
  on public.memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- ============================================================
-- match_memories: cosine similarity search scoped to a user
-- ============================================================
create or replace function public.match_memories(
  query_embedding       vector(1536),
  match_count           int     default 10,
  filter_user_id        uuid    default null,
  similarity_threshold  float   default 0.65
)
returns table (
  id          uuid,
  content     text,
  category    text,
  importance  numeric,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    m.category,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.memories m
  where
    (filter_user_id is null or m.user_id = filter_user_id)
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= similarity_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.memories enable row level security;

drop policy if exists "memories_owner" on public.memories;
create policy "memories_owner" on public.memories
  for all
  using   (auth.uid() = user_id)
  with check (auth.uid() = user_id);
