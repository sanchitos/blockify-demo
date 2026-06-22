import {
  ingest,
  parseIdeaBlocks,
  chunkText,
  naiveChunks,
  distillBlocks,
  mapLimit,
} from "./blockify";
import { embed } from "./openai";
import { getSupabaseAdmin } from "./supabase";

// Max simultaneous outbound API calls (ingest + embeddings).
const CONCURRENCY = Number(process.env.BLOCKIFY_CONCURRENCY) || 4;

export interface BlockifyResult {
  chunks: number;
  draftBlocks: number;
  count: number;
  blocks: any[];
}

export interface NaiveResult {
  chunks: number;
  count: number;
}

export interface ProcessAllResult {
  blockify: BlockifyResult;
  naive: NaiveResult;
}

/** Carries an HTTP status + optional raw payload so routes can surface it. */
export class PipelineError extends Error {
  status: number;
  raw?: string;
  constructor(message: string, status = 500, raw?: string) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

/**
 * Blockify pipeline: chunk -> ingest (bounded) -> distill in batches ->
 * embed (bounded) -> store in `ideablocks`.
 */
export async function processBlockify(opts: {
  text: string;
  source?: string;
  useDistill?: boolean;
}): Promise<BlockifyResult> {
  const { text, source, useDistill = true } = opts;

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new PipelineError("No text to process", 400);

  const ingestResults = await mapLimit(chunks, CONCURRENCY, (c) => ingest(c));
  let blocks = ingestResults.flatMap(parseIdeaBlocks);
  if (blocks.length === 0) {
    throw new PipelineError(
      "Blockify returned no IdeaBlocks",
      422,
      ingestResults.join("\n")
    );
  }

  const draftCount = blocks.length;

  if (useDistill && blocks.length > 1) {
    try {
      blocks = await distillBlocks(blocks, CONCURRENCY);
    } catch {
      // Keep undistilled blocks on failure.
    }
  }

  const rows = await mapLimit(blocks, CONCURRENCY, async (b) => {
    const embedInput = [b.name, b.critical_question, b.trusted_answer, b.keywords]
      .filter(Boolean)
      .join("\n");
    const embedding = await embed(embedInput);
    return { ...b, source: source ?? null, embedding };
  });

  const { data, error } = await getSupabaseAdmin()
    .from("ideablocks")
    .insert(rows)
    .select(
      "id,name,critical_question,trusted_answer,tags,entity_name,keywords,created_at"
    );

  if (error) throw new PipelineError(error.message, 500);

  return {
    chunks: chunks.length,
    draftBlocks: draftCount,
    count: data!.length,
    blocks: data!,
  };
}

/**
 * Naive baseline: fixed-window chunk -> embed raw chunk (bounded) ->
 * store in `naive_chunks`. No Blockify, no distillation.
 */
export async function processNaive(opts: {
  text: string;
  source?: string;
}): Promise<NaiveResult> {
  const { text, source } = opts;

  const chunks = naiveChunks(text);
  if (chunks.length === 0) return { chunks: 0, count: 0 };

  const rows = await mapLimit(chunks, CONCURRENCY, async (content) => ({
    content,
    source: source ?? null,
    embedding: await embed(content),
  }));

  const { data, error } = await getSupabaseAdmin()
    .from("naive_chunks")
    .insert(rows)
    .select("id");

  if (error) throw new PipelineError(error.message, 500);

  return { chunks: chunks.length, count: data!.length };
}

/**
 * Run BOTH pipelines on the same source text so the two stores stay in sync
 * for a fair side-by-side comparison.
 */
export async function processAll(opts: {
  text: string;
  source?: string;
  useDistill?: boolean;
}): Promise<ProcessAllResult> {
  const [blockify, naive] = await Promise.all([
    processBlockify(opts),
    processNaive(opts),
  ]);
  return { blockify, naive };
}
