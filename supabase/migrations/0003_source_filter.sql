-- Add an optional source filter to both search functions so the UI can scope
-- a question to a single document. The filter is applied INSIDE the query
-- (before the top-k cutoff), so results stay correct.
-- Run this in the Supabase SQL editor after 0001 and 0002.

-- Drop the old signatures so we can add the new parameter cleanly.
drop function if exists public.match_ideablocks(vector, integer, double precision);
drop function if exists public.match_naive_chunks(vector, integer, double precision);

create or replace function public.match_ideablocks(
  query_embedding      vector(1536),
  match_count          int    default 6,
  similarity_threshold float  default 0.0,
  filter_source        text   default null
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
    and (filter_source is null or b.source = filter_source)
  order by b.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_naive_chunks(
  query_embedding      vector(1536),
  match_count          int    default 6,
  similarity_threshold float  default 0.0,
  filter_source        text   default null
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
    and (filter_source is null or c.source = filter_source)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
