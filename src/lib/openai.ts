import OpenAI from "openai";

let client: OpenAI | null = null;

export const EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

// Lazily create the client so importing this module during `next build`
// doesn't require OPENAI_API_KEY to be present.
export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in .env.local");
  client = new OpenAI({ apiKey });
  return client;
}

/** Embed a single string into a 1536-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}
