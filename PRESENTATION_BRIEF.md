# Presentation Brief — Blockify vs. Naive RAG Demo

> **Purpose of this document.** This is a self-contained briefing for building a
> presentation about the demo in this repo. It contains everything needed —
> the concept, architecture, the experiment, the real results, and a suggested
> slide outline + live-demo script. You should not need to read the source code
> to build the deck, but file references are included for anyone who wants them.
>
> **Tone to aim for:** technical, honest, and non-salesy. The most credible part
> of this story is that we tested fairly and reported where the new approach
> *didn't* help, not just where it did.

---

## 1. The one-paragraph summary

We built a working web app that ingests documents two different ways — **Blockify
(distilled "IdeaBlocks")** and **naive fixed-size chunking** — stores both in the
same vector database, and answers questions from each side **side-by-side using an
identical prompt**. The goal was to honestly compare retrieval quality. The
headline finding: on a single short, clean document, naive RAG is perfectly good
and Blockify's advantages don't show; Blockify is built to win under different
conditions (scale, redundancy, large/noisy corpora), which a 2-page test can't
surface.

---

## 2. What is Blockify?

Blockify (by Iternal Technologies) is a data-ingestion pipeline that replaces
fixed-size RAG chunking with **IdeaBlocks** — small, self-contained units of
knowledge. Instead of slicing a document into arbitrary character windows, it
distills the content into atomic facts.

**Each IdeaBlock is structured:**
- `name` — human-readable title
- `critical_question` — the question this block answers
- `trusted_answer` — the verified answer
- `tags` — topical/category labels (e.g. `BUG FIX`, `PERMISSIONS`)
- `entity` — the primary entity (product, person, concept) + type
- `keywords` — retrieval terms

**Three-stage model pipeline** (exposed as an OpenAI-compatible chat endpoint at
`https://api.blockify.ai/v1/chat/completions`, model selected via the `model` field):
1. `ingest` — raw text → draft IdeaBlocks
2. `distill` — merge/deduplicate similar IdeaBlocks
3. `technical-ingest` — for ordered/structured content (manuals, runbooks)

**Vendor's claimed benefits** (use as "claimed," not proven by our demo):
~40× data compression, ~2.29× vector-search accuracy, ~3.09× token efficiency,
~78× aggregate improvement. These come from deduplication and distillation at
scale.

---

## 3. What we built (the demo)

A **Next.js (TypeScript)** app with two tabs:

- **Add text / Upload PDF** — paste text or upload a PDF; it runs *both* pipelines
  on the same source and stores into two separate tables.
- **Ask questions** — type one question, get **two answers side-by-side**
  (Blockify vs. naive), each showing the retrieved sources and their similarity %.

### Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Vector DB | Supabase Postgres + `pgvector` (HNSW, cosine) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Answer model | OpenAI `gpt-4o-mini` |
| Distillation | Blockify API (`ingest`, `distill`) |
| PDF parsing | `pdf-parse` |

### The two pipelines

**Blockify pipeline** (`processBlockify`, stored in `ideablocks` table):
1. Chunk text into ~2,000-char pieces (Blockify's recommended ingest size).
2. `ingest` each chunk → draft IdeaBlocks (bounded concurrency + retry/backoff).
3. `distill` across all blocks **in batches** (hierarchical reduce) to dedupe.
4. Embed each block and store.

**Naive pipeline** (`processNaive`, stored in `naive_chunks` table):
1. Slice text into fixed **1,000-char windows with 150-char overlap** (no semantic
   boundaries — the conventional baseline).
2. Embed each raw chunk and store.

Both run on every upload via `processAll`, so the two stores always hold the same
documents.

### The ask flow (this is the fairness-critical part)
1. Embed the question **once**.
2. Retrieve top-k from **both** tables (`match_ideablocks`, `match_naive_chunks`).
3. Generate **two answers with one shared function** — *identical* system prompt,
   model, temperature (0.4), and top-k. **The only variable is what was retrieved.**

> Slide-worthy point: a valid comparison holds everything constant except the one
> thing being tested. Here that's the retrieval method — not the prompt.

### Key engineering details worth a mention
- **Chunking before ingest** — long docs/PDFs exceed model context; we chunk first.
- **Bounded concurrency** (`mapLimit`) instead of unbounded `Promise.all`, plus
  **retry with exponential backoff** on 429/5xx — the "how to call an API in
  parallel without melting it" lesson.
- **Batched distillation** — distilling hundreds of blocks in one call would
  overflow, so we reduce in batches of 20 until they fit, then a final pass.

---

## 4. The experiment & the real results

**Test corpus:** `D360 v2.17.0 Release Notes` — a 2-page internal release-notes PDF
containing ~12 distinct changes, grouped under headers (Enhancements, Bug Fixes,
Permissions & Cleanup).

### Result A — a "needle" question
> *"When is D360 going to be launched?" / "What's the last version of D360?"*

Both retrieved the right block. Early on, a too-strict prompt made the model
**refuse** ("I don't have enough information") even though the answer was retrieved
— a great teaching moment that **retrieval and generation are separate failure
points**, and that prompt design matters as much as retrieval. After loosening the
prompt, both answered correctly.

### Result B — a "coverage" question (the interesting one)
> *"List every change in the D360 2.17.0 release."* (at top-k = 6)

| | Blockify | Naive |
|---|:--:|:--:|
| Distinct changes listed | **6 of ~12** | **~12 of 12** |
| Preserved doc categories (Bug Fixes, etc.) | No | **Yes** |

**Naive gave the more complete, better-organized answer.** Why — and this is the
single most important insight in the whole demo:

- **Top-k interacts with retrieval-unit size.** Naive turned the short doc into
  only ~5 fat chunks (each ~1,000 chars packing several changes). At k=6 it
  retrieved *the entire document*. Blockify made ~12 atomic blocks; at k=6 it
  retrieved only *half*, so the answer was truncated.
- **Naive preserved structure for free** — the raw chunk text still contained the
  literal section headers ("BUG FIXES"), so the model mirrored them. Blockify
  flattens layout into atomic facts, but carries the category in each block's
  `tags` field.

### What we changed after the finding
- **Raised default top-k to 12** so fine-grained blocks aren't truncated on
  coverage questions.
- **Enriched the Blockify context with `tags` + `entity`** so it can organize by
  category from *structured metadata* (more reliable than a header that happened to
  land in a chunk).

> Slide-worthy lesson: **fine-grained retrieval needs a higher k.** Granularity
> that makes Blockify *precise* on needle questions makes it need *more slots* on
> coverage questions.

---

## 5. The honest verdict (do not skip this — it's the credibility)

**On a single short, clean document, naive RAG is the pragmatic choice and Blockify
is overkill.** Our test doc was close to Blockify's *worst case*: nothing to dedupe,
no noise to cut through, tiny corpus.

**Where Blockify actually earns its place:**

| Condition | Why Blockify wins |
|---|---|
| Many docs with overlap/duplication | Dedupes into canonical blocks; naive returns near-duplicate chunks that waste retrieval slots |
| Large, noisy documents (100+ pages) | Atomic blocks retrieve the needle; naive top-k covers a small % and misses it |
| High query volume / token cost | Denser context = fewer tokens per query |
| Messy/inconsistent source text | Normalizes into clean, consistent facts |

**Where naive is fine or better:**
- A handful of short, clean documents.
- "Reproduce the document's structure" tasks (raw chunks keep layout implicitly).
- When you don't want a third-party processing step in the pipeline.

**Bottom line for the audience:** choose the retrieval strategy based on corpus
shape — size, redundancy, and noise — not on hype. The demo's value is that it lets
you *measure* the difference for your own data instead of guessing.

---

## 6. Suggested slide outline

1. **Title** — "RAG that earns its keep: Blockify vs. naive chunking, measured."
2. **The problem** — naive RAG chunks arbitrarily; relevant facts get diluted in big
   slabs. Is a smarter ingestion worth it?
3. **What is Blockify / IdeaBlocks** — the structured-atom concept (show an example
   IdeaBlock).
4. **What we built** — architecture diagram: text/PDF → two pipelines → Supabase
   (two tables) → side-by-side answers.
5. **The fairness design** — same prompt, model, temp, k; only retrieval differs.
6. **Demo 1: a needle question** — Blockify's strength; also the retrieval-vs-
   generation lesson (the refusal story).
7. **Demo 2: the coverage question** — the surprising result: naive won at k=6.
8. **Why** — top-k × granularity; structure-in-text vs. structure-in-tags. (The
   core technical insight.)
9. **What we changed** — higher k, enriched context with tags/entity.
10. **The honest verdict** — the two condition tables from §5.
11. **Takeaways** — match retrieval strategy to corpus shape; measure, don't assume;
    retrieval and generation fail independently.
12. **Appendix** — stack, engineering notes (chunking, bounded concurrency, batched
    distill), links.

---

## 7. Live-demo script (if presenting the app)

1. **Show ingestion** — upload the D360 release-notes PDF. Point out the result line:
   "*N pages · Blockify: ~12 IdeaBlocks · Naive: ~5 raw chunks*." Show one IdeaBlock
   (name / question / answer / tags) vs. the idea of a raw 1,000-char chunk.
2. **Needle question** — ask *"What email address do separation emails go to?"*
   Expected: Blockify answers cleanly (`driverpayroll@crengland.com`); naive may bury
   it or dilute. This is Blockify's home turf.
3. **Coverage question** — ask *"List every change in the D360 2.17.0 release."*
   With k=12 + enrichment, Blockify should now be complete and organized by category;
   contrast with what it did at k=6 (truncated to 6) to tell the top-k story.
4. **Close on the verdict** — "naive was fine here because it's one clean short doc;
   here's where Blockify pulls ahead." Show the condition tables.

**Good demo questions to have ready:**
- Needle: *"Who can edit Accident Review Expiration cases?"* (→ Safety Manager role)
- Needle: *"Where does the involuntary separation reason come from?"* (→ "Grounds for Discipline")
- Coverage: *"List every bug fix in this release."*
- Paraphrase: *"What's the latest version of D360?"* (doc says "release… announced")

---

## 8. Caveats to state out loud (keeps it honest)

- Single-document, small-corpus test — **cannot** demonstrate dedup/scale benefits.
- "Claimed" vendor metrics (40×, 2.29×, etc.) are **not** reproduced by this demo.
- Naive baseline quality depends on chunk size/overlap (we used 1,000/150); different
  settings shift its results.
- Results use `gpt-4o-mini` + `text-embedding-3-small`; bigger models would change
  absolute quality (though likely not the *relative* story).

---

## 9. Source map (for the curious)
- Pipelines: `src/lib/pipeline.ts` (`processBlockify`, `processNaive`, `processAll`)
- Blockify client + chunkers: `src/lib/blockify.ts`
- Ask / comparison logic: `src/app/api/ask/route.ts`
- Ingest / upload routes: `src/app/api/ingest/route.ts`, `src/app/api/upload/route.ts`
- UI: `src/app/page.tsx`
- DB schema: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_naive_chunks.sql`
- Cleanup: `npm run cleanup` (`scripts/cleanup.mjs`)
