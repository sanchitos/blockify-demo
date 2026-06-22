const BLOCKIFY_URL =
  process.env.BLOCKIFY_API_URL ||
  "https://api.blockify.ai/v1/chat/completions";

export interface IdeaBlock {
  name: string;
  critical_question: string;
  trusted_answer: string;
  tags: string;
  entity_name: string;
  entity_type: string;
  keywords: string;
  /** The raw <ideablock>…</ideablock> XML, kept verbatim. */
  content: string;
}

const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Call a Blockify model (OpenAI-compatible chat endpoint) and return the content string. */
async function callBlockify(
  model: string,
  content: string,
  attempt = 0
): Promise<string> {
  const apiKey = process.env.BLOCKIFY_API_KEY;
  if (!apiKey) throw new Error("Missing BLOCKIFY_API_KEY in .env.local");

  const res = await fetch(BLOCKIFY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 8000,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    // Retry transient failures (rate limits / server errors) with backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** attempt);
      return callBlockify(model, content, attempt + 1);
    }
    const body = await res.text();
    throw new Error(`Blockify "${model}" failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Convert raw text into draft IdeaBlocks (XML). */
export function ingest(text: string): Promise<string> {
  return callBlockify("ingest", text);
}

/** Merge / deduplicate a set of IdeaBlocks (pass the XML returned by ingest). */
export function distill(ideablocksXml: string): Promise<string> {
  return callBlockify("distill", ideablocksXml);
}

/**
 * Run `fn` over every item, but with at most `limit` promises in flight at once.
 * Preserves input order in the returned array.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const DISTILL_BATCH_SIZE = 20;
const DISTILL_MAX_ROUNDS = 5;

/**
 * Distill a large set of IdeaBlocks without overflowing a single distill call.
 *
 * Blocks are distilled in batches of `DISTILL_BATCH_SIZE`; each round dedupes
 * within its batch and shrinks the set. Rounds repeat (hierarchical reduce)
 * until everything fits in one batch, then a final pass dedupes across the
 * survivors. Stops early if a round stops making progress.
 */
export async function distillBlocks(
  blocks: IdeaBlock[],
  concurrency = 4
): Promise<IdeaBlock[]> {
  if (blocks.length <= 1) return blocks;

  let current = blocks;
  let rounds = 0;

  while (current.length > DISTILL_BATCH_SIZE && rounds < DISTILL_MAX_ROUNDS) {
    const prevCount = current.length;
    const batches = chunkArray(current, DISTILL_BATCH_SIZE);
    const results = await mapLimit(batches, concurrency, async (batch) =>
      parseIdeaBlocks(await distill(batch.map((b) => b.content).join("\n")))
    );
    current = results.flat();
    rounds++;
    // No progress (or it grew) — stop to avoid looping / wasting calls.
    if (current.length >= prevCount) break;
  }

  // Final consolidation once the set fits in a single batch.
  if (current.length > 1 && current.length <= DISTILL_BATCH_SIZE) {
    current = parseIdeaBlocks(
      await distill(current.map((b) => b.content).join("\n"))
    );
  }

  return current;
}

/**
 * Split text into chunks suitable for the ingest model.
 * Blockify recommends 1,000–4,000 char inputs; we target ~2,000 and break on
 * paragraph boundaries so IdeaBlocks aren't cut mid-thought.
 */
export function chunkText(text: string, maxChars = 2000): string[] {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = "";

  for (const raw of paragraphs) {
    const para = raw.trim();
    if (!para) continue;

    // A single paragraph longer than the limit gets hard-split.
    if (para.length > maxChars) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }

    if (buf && buf.length + para.length + 2 > maxChars) {
      chunks.push(buf);
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }

  if (buf) chunks.push(buf);
  return chunks;
}

/**
 * Naive fixed-window chunking with overlap — the conventional RAG baseline,
 * for comparison against Blockify. Deliberately ignores semantic boundaries:
 * it just slices the text into overlapping windows.
 */
export function naiveChunks(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const step = Math.max(1, size - overlap);
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += step) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return out;
}

function tagText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

/** Parse one or more <ideablock> elements out of a Blockify response. */
export function parseIdeaBlocks(xml: string): IdeaBlock[] {
  const matches = xml.match(/<ideablock>[\s\S]*?<\/ideablock>/gi) || [];
  return matches.map((block) => ({
    name: tagText(block, "name"),
    critical_question: tagText(block, "critical_question"),
    trusted_answer: tagText(block, "trusted_answer"),
    tags: tagText(block, "tags"),
    entity_name: tagText(block, "entity_name"),
    entity_type: tagText(block, "entity_type"),
    keywords: tagText(block, "keywords"),
    content: block.trim(),
  }));
}
