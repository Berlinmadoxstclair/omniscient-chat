# Omniscient Chat

An open-source, cloud-hosted AI chat that routes each message to the best model for the task. Multiple providers, one UI.

## What it does

- **Auto-routing** — A fast classifier (Gemini Flash) labels each prompt as `code / reasoning / creative / vision / longcontext / uncensored / general` and forwards it to the model best suited for that category.
- **Manual override** — Pin any model from the picker; the classifier is bypassed.
- **RAG** — Upload PDFs or text. They're chunked, embedded with `text-embedding-3-small`, stored in pgvector. Top-5 chunks are injected into the system prompt on every turn.
- **Email + password auth** — Supabase Auth, standard sign-in / sign-up flow.
- **Audit trail** — Every routing decision is logged (`category`, `confidence`, `chosen_model`, classifier latency) so you can tune the routing table from real data.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Vercel AI SDK (`streamText`, `generateObject`) for streaming + structured classifier output
- **OpenRouter** as the single gateway to 300+ models
- **OpenAI** for embeddings only (`text-embedding-3-small`, 1536 dims)
- **Supabase** (Postgres + Auth + pgvector) for everything stateful
- **Vercel** for hosting

## Architecture

```
User → /api/chat ──► Classifier (Gemini Flash) ──► {category, model}
                  ──► RAG retrieve (pgvector top-k)
                  ──► streamText(model, system + ragContext + history)
                  ──► onFinish: persist message + routing_decision
```

The router lives in `lib/classifier.ts`; the category→model table lives in `lib/models.ts`. Edit the table to retune — no other code changes needed.

---

## Deploy (cloud, ~10 minutes)

You'll provision three accounts (Supabase, OpenRouter, OpenAI), push the repo to GitHub, deploy on Vercel, and paste the env vars. That's the whole flow.

### 1. Supabase project

1. Go to https://supabase.com → New Project. Pick a region close to you.
2. Once it's up, open **SQL Editor** → New query → paste the contents of `supabase/migrations/0001_init.sql` → Run. This creates all tables, RLS policies, the `match_chunks` RPC, and the pgvector extension.
3. Go to **Project Settings → API** and copy these three values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Authentication → URL Configuration** and set Site URL to your Vercel URL (you'll have this after step 4). Add `https://<your-vercel-url>/auth/callback` to **Redirect URLs**.
5. **Optional but recommended for personal use:** Authentication → **Providers → Email** → toggle **Confirm email** OFF. With it off, sign-up logs you in immediately; with it on, Supabase emails a confirmation link first.

### 2. OpenRouter

1. https://openrouter.ai → sign in → Credits → add $10 (or whatever you want).
2. Keys → Create Key → copy.
3. This single key powers Claude, GPT, Gemini, DeepSeek, Hermes, Dolphin, all of it. Per-model pricing is on https://openrouter.ai/models.

### 3. OpenAI

1. https://platform.openai.com/api-keys → Create new secret key.
2. Used only for embeddings. Cost is trivial — `text-embedding-3-small` is $0.02 per million tokens.

### 4. Vercel

1. Push this folder to a GitHub repo (private is fine).
2. https://vercel.com → Add New → Project → import the repo.
3. Framework preset: Next.js (auto-detected).
4. **Environment Variables** — paste in:
   ```
   OPENROUTER_API_KEY=
   OPENAI_API_KEY=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   ```
5. Deploy.
6. Once it's live, go back to Supabase → **Authentication → URL Configuration** and confirm the redirect URL matches your live Vercel domain.

### 5. Sign in

Open your Vercel URL, enter your email, click the magic link. Done.

---

## Accounts / API keys you need to send me

Paste these back to me and I'll wire them into a `.env.local` you can drop into Vercel:

| Variable | Where to get it |
|---|---|
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (treat as a password — server-only) |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel production URL after deploy |

Optional, only if you want polished sender addresses on the magic-link emails:
- Resend or Postmark API key → configure as Custom SMTP in Supabase → Auth → SMTP Settings.

---

## Tuning the router

`lib/models.ts` is the only file you need to edit to retune. Each category has a `primary` and `fallback` slug. Verify slugs are current at https://openrouter.ai/models — they shift as providers rev versions.

To force-pick a model for testing, use the dropdown in the chat header. The classifier badge shows what *would* have been picked in auto mode.

## Project layout

```
app/
  api/
    chat/route.ts             # main streaming endpoint (classify → retrieve → stream → persist)
    conversations/            # list / get / delete
    documents/                # RAG upload / list / delete
  auth/                       # magic-link callback + signout
  login/page.tsx
  page.tsx                    # main chat shell
components/
  chat/                       # sidebar, surface, model picker, docs panel, markdown
  ui/                         # shadcn primitives
lib/
  classifier.ts               # generateObject prompt + schema
  models.ts                   # category → model table
  openrouter.ts               # OpenAI-compat client
  rag.ts                      # chunk, embed, retrieve
  supabase/                   # browser, server, middleware clients
supabase/
  migrations/0001_init.sql    # schema + RLS + match_chunks RPC + new-user trigger
```

## What's intentionally left for v2

- **Image input** — the classifier short-circuits to vision when an image is present, but the composer doesn't have an attach button yet. Easy add to `chat-surface.tsx`.
- **Tool use / web search** — not wired. Easy to add via `tools` in `streamText`.
- **Multi-user** — RLS is correct so it's safe, but the UI assumes a personal-use single account.

## Local development (optional)

If you ever want to run it locally:

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # paste the same keys
npm run dev                  # http://localhost:3000
```

A Dockerfile + docker-compose.yml are included if you decide to self-host later, but you can ignore them for cloud-only.

## License

MIT.
