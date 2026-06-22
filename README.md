# Blockify Demo

A minimal Next.js app that:

1. Takes text you paste into a UI.
2. Sends it to the **Blockify** API (`ingest` → `distill`) to produce **IdeaBlocks**.
3. Embeds each IdeaBlock with **OpenAI** and stores it in **Supabase** (`pgvector`).
4. Lets you **ask questions** — the question is embedded, the closest IdeaBlocks
   are retrieved via cosine similarity, and OpenAI answers from them (RAG).

## 1. Configure environment

Copy `.env.example` to `.env.local` (already created — just fill it in):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...      # Project Settings → API → service_role
BLOCKIFY_API_KEY=...
OPENAI_API_KEY=...
```

## 2. Set up the Supabase schema

Open the **Supabase SQL Editor** and paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then run it.
(Or with the Supabase CLI: `supabase db push`.)

This enables `pgvector`, creates the `ideablocks` table + HNSW index, and the
`match_ideablocks()` similarity function used by the Ask feature.

## 3. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- **Add text** tab → paste text → *Process & save*.
- **Ask questions** tab → ask anything about what you've stored.

## Notes

- Embeddings use `text-embedding-3-small` (1536 dims) — must match the
  `vector(1536)` column in the migration. Change both together if you swap models.
- The `service_role` key bypasses RLS and is used only in server-side API routes;
  it is never exposed to the browser.
