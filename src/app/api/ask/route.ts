import { NextResponse } from "next/server";
import { embed, getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// IDENTICAL answering setup for both pipelines — the only variable in the
// comparison is what got retrieved (IdeaBlocks vs raw chunks), not the prompt.
const SYSTEM_PROMPT =
  "You are a friendly, helpful assistant answering questions about the user's documents, using the reference information provided. " +
  "Closely related terms are equivalent (e.g. 'release', 'announced', and 'launch' refer to the same event, and a stated release/announcement date answers when something launched). " +
  "Write in a natural, conversational tone, the way you'd explain something to a colleague. " +
  "Answer the question directly. Do NOT mention 'blocks', 'sources', reference numbers, or that you were given any context — just give the answer. " +
  "If none of the reference information is relevant, simply say you couldn't find that in the documents.";

async function generate(
  question: string,
  contextLines: string[]
): Promise<string> {
  if (contextLines.length === 0) {
    return "I couldn't find anything relevant in the documents.";
  }
  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Reference information:\n${contextLines.join("\n")}\n\nQuestion: ${question}`,
      },
    ],
  });
  return completion.choices[0].message.content ?? "";
}

export async function POST(req: Request) {
  try {
    const { question, matchCount = 6 } = await req.json();
    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    // 1. Embed the question once; reuse the vector for both retrievers.
    const queryEmbedding = await embed(question);
    const supa = getSupabaseAdmin();

    const [bRes, nRes] = await Promise.all([
      supa.rpc("match_ideablocks", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      }),
      supa.rpc("match_naive_chunks", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      }),
    ]);

    if (bRes.error) throw bRes.error;

    const bMatches = bRes.data ?? [];
    // If the naive table/function isn't set up yet, degrade gracefully.
    const naiveAvailable = !nRes.error;
    const nMatches = naiveAvailable ? nRes.data ?? [] : [];

    // 2. Same prompt, same model, same temperature — different context.
    const [blockifyAnswer, naiveAnswer] = await Promise.all([
      generate(
        question,
        bMatches.map((m: any) => `- ${m.name}: ${m.trusted_answer}`)
      ),
      naiveAvailable
        ? generate(
            question,
            nMatches.map((m: any) => `- ${m.content}`)
          )
        : Promise.resolve(
            "Naive index not set up. Run migration 0002_naive_chunks.sql and re-ingest your documents."
          ),
    ]);

    return NextResponse.json({
      blockify: { answer: blockifyAnswer, sources: bMatches },
      naive: {
        answer: naiveAnswer,
        sources: nMatches,
        available: naiveAvailable,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
