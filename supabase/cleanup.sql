-- Wipe all ingested data from both stores. Run in the Supabase SQL editor.
truncate table public.ideablocks;
truncate table public.naive_chunks;

-- To clear only one source file instead, use:
--   delete from public.ideablocks   where source = 'my-file.pdf';
--   delete from public.naive_chunks where source = 'my-file.pdf';
