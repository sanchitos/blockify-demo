-- Naive RAG baseline: raw fixed-size text chunks embedded directly (no Blockify).
-- Used for side-by-side accuracy comparison against the distilled IdeaBlocks.
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- 1. Storage for raw chunks
create table if not exists public.naive_chunks (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,            -- the raw chunk text, embedded as-is
  source     text,
  embedding  vector(1536),
  created_at timestamptz not null default now()
);

-- 2. Cosine similarity index
create index if not exists naive_chunks_embedding_idx
  on public.naive_chunks
  using hnsw (embedding vector_cosine_ops);

-- 3. Similarity search function (mirrors match_ideablocks)
create or replace function public.match_naive_chunks(
  query_embedding      vector(1536),
  match_count          int   default 6,
  similarity_threshold float default 0.0
)
returns table (
  id         uuid,
  content    text,
  source     text,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.content,
    c.source,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.naive_chunks as c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
