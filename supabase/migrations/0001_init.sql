-- Blockify demo schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI: `supabase db push`).
-- text-embedding-3-small produces 1536-dim vectors.

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Storage for IdeaBlocks
create table if not exists public.ideablocks (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  critical_question text,
  trusted_answer    text,
  tags              text,
  entity_name       text,
  entity_type       text,
  keywords          text,
  content           text not null,           -- raw <ideablock> XML returned by Blockify
  source            text,                     -- optional label for where the text came from
  embedding         vector(1536),
  created_at        timestamptz not null default now()
);

-- 3. Approximate-nearest-neighbour index for fast cosine similarity search
create index if not exists ideablocks_embedding_idx
  on public.ideablocks
  using hnsw (embedding vector_cosine_ops);

-- 4. Similarity search function used by /api/ask
create or replace function public.match_ideablocks(
  query_embedding      vector(1536),
  match_count          int   default 6,
  similarity_threshold float default 0.0
)
returns table (
  id                uuid,
  name              text,
  critical_question text,
  trusted_answer    text,
  tags              text,
  entity_name       text,
  keywords          text,
  content           text,
  similarity        float
)
language sql
stable
as $$
  select
    b.id,
    b.name,
    b.critical_question,
    b.trusted_answer,
    b.tags,
    b.entity_name,
    b.keywords,
    b.content,
    1 - (b.embedding <=> query_embedding) as similarity
  from public.ideablocks as b
  where b.embedding is not null
    and 1 - (b.embedding <=> query_embedding) > similarity_threshold
  order by b.embedding <=> query_embedding
  limit match_count;
$$;
