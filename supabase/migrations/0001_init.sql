-- Omniscient Chat — initial schema
-- Requires Postgres 15+ with pgvector extension

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- profiles: 1:1 with auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  created_at timestamptz default now() not null
);

-- ============================================================
-- conversations: a chat thread
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'New chat' not null,
  pinned boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);

-- ============================================================
-- messages: individual turns
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,                 -- which model produced an assistant turn
  category text,              -- classifier category (code/reasoning/etc.)
  created_at timestamptz default now() not null
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ============================================================
-- routing_decisions: classifier audit log
-- ============================================================
create table if not exists public.routing_decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  user_prompt text not null,
  category text not null,
  confidence numeric,
  chosen_model text not null,
  manual_override boolean default false not null,
  reasoning text,
  latency_ms integer,
  created_at timestamptz default now() not null
);
create index if not exists routing_user_idx on public.routing_decisions(user_id, created_at desc);

-- ============================================================
-- documents: uploaded source files
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text,
  byte_size integer,
  status text default 'processing' not null check (status in ('processing', 'ready', 'failed')),
  error text,
  created_at timestamptz default now() not null
);
create index if not exists documents_user_idx on public.documents(user_id, created_at desc);

-- ============================================================
-- document_chunks: embedded chunks (pgvector)
-- text-embedding-3-small = 1536 dims
-- ============================================================
create table if not exists public.document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now() not null
);
create index if not exists chunks_doc_idx on public.document_chunks(document_id, chunk_index);
create index if not exists chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- match_chunks RPC: cosine similarity search scoped to a user
-- ============================================================
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  filter_user_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where filter_user_id is null or c.user_id = filter_user_id
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================
-- Auto-create profile row on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.routing_decisions enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- profiles: user sees only their own row
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- conversations: user owns
drop policy if exists "conversations_owner" on public.conversations;
create policy "conversations_owner" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: through conversation ownership
drop policy if exists "messages_owner" on public.messages;
create policy "messages_owner" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- routing_decisions: user owns
drop policy if exists "routing_owner" on public.routing_decisions;
create policy "routing_owner" on public.routing_decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- documents: user owns
drop policy if exists "documents_owner" on public.documents;
create policy "documents_owner" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- document_chunks: user owns
drop policy if exists "chunks_owner" on public.document_chunks;
create policy "chunks_owner" on public.document_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
