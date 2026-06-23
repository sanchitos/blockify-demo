# Presentation Brief — UPDATE 3: "Distillation is lossy" (the key finding)

> **Read order:** `PRESENTATION_BRIEF.md` → `..._UPDATE.md` → `..._UPDATE_2.md` → **this**.
>
> This is the most important and most defensible finding of the project. It came
> from a *new* test corpus (a redundant, multi-source knowledge base — `acme-driver-kb`)
> built specifically to give Blockify its best shot. Blockify still lost — and in
> doing so revealed a fundamental trade-off. Use this as the analytical climax of
> the talk.

---

## 1. The one-sentence claim (stay inside this — it's bulletproof)

> **For small, single documents and exact-fact lookup, Blockify provided no
> retrieval benefit over naive chunking — and its distillation actively lost data.**

Do **not** say "Blockify doesn't work." We never tested it at the large, redundant
scale it is designed for, so that would be an overclaim. The narrow claim above is
exactly what we measured and cannot be attacked.

---

## 2. The evidence (this table is the argument)

Corpus: `acme-driver-kb` — a knowledge base with one topic repeated 5× (fuel-card
PIN reset) plus several buried, single-mention operational facts. Both pipelines
ingested the identical text; questions were scoped to this one document; k=6.

**Blockify produced 10 IdeaBlocks. It dropped 4 facts entirely:**

| Fact (buried, single mention) | Blockify | Naive (raw chunks) |
|---|:--:|:--:|
| After-hours emergency # `1-800-555-0147` | ❌ **dropped** | ✅ kept |
| Detention pay policy ($20/hr after 2 hrs) | ❌ **dropped** | ✅ kept |
| Approved ELD firmware `4.8.2` | ❌ **dropped** | ✅ kept |
| Breakdown protocol | ❌ **dropped** | ✅ kept |
| Fuel-card PIN reset (repeated 5×) | ✅ kept (deduped 5→1) | ✅ kept |

Verified directly against the database: 10 Blockify blocks vs. 5 naive chunks; the
four facts above appear in **zero** IdeaBlocks but in the naive chunks.

### What the two test questions showed
- **Needle — "What's the after-hours emergency dispatch number?"**
  - Naive: **correct** — `1-800-555-0147` (top chunk similarity 0.66).
  - Blockify: **"I couldn't find that in the documents."** Not a retrieval miss —
    the fact was **never stored**. Distillation deleted it.
- **Coverage — "List all the distinct procedures."**
  - Naive: more complete (~9 procedures).
  - Blockify: fewer (~5) — fine-grained blocks truncated at k=6.
  - Net: naive won this too.

**Naive won both questions.** The dedup Blockify is good at *did* happen (5 fuel-card
mentions → 1 block), but it was irrelevant next to the data loss.

---

## 3. Why this happens — the mechanism (explain this, don't just assert)

Blockify's headline feature is **40× compression**. Compressing language by 97% is
**lossy by definition** — you must throw text away. The finding is simply *what* it
throws away:

> **Blockify is a summarization system, not a storage system.** It keeps what
> recurs and looks "important," and discards one-off specifics. That is a feature on
> a large, repetitive corpus — and a liability on a small document where every fact
> matters.

The clean trade-off to put on a slide:

| | Recall | Retrieval cleanliness | Storage / cost |
|---|---|---|---|
| **Naive chunks** | Complete (verbatim) | Noisy, redundant | Large |
| **Blockify** | **Lossy** (drops specifics) | Clean, deduped | Compact |

---

## 4. Why this does NOT contradict Blockify's published numbers

Their "2.29× accuracy / 40× compression / 78× aggregate" come from **large,
redundant, multi-document enterprise corpora**, where naive RAG drowns in duplicate
chunks and dedup wins. **Our corpus was small and clean — Blockify's worst case by
its own design.** We are not disputing their benchmark; we are showing it **does not
transfer** to small-document, exact-lookup use. Say this explicitly; it disarms the
"but the vendor says…" objection.

---

## 5. Caveats you MUST state (they make you more credible, not less)

1. **Scale.** A single, small document — not Blockify's target (multi-doc, redundant,
   large). We did not test at scale.
2. **Model choice.** We used the general **`ingest`** model. Blockify also ships
   **`technical-ingest`**, built for ordered/procedural content, which *may* preserve
   more detail. **We did not test it.** (This is the one fair counter a Blockify rep
   will raise — say it first.)
3. **Defaults + stochasticity.** Default settings, limited runs, non-deterministic
   LLM output. Single screenshots are illustrative, not statistical.

---

## 6. Suggested slides to add

- **"We gave Blockify its best shot"** — describe the redundant KB corpus and why it
  *should* favor Blockify (dedup).
- **"It lost data"** — the §2 table. Punchline: *"Blockify deleted the emergency
  phone number. Naive kept it."*
- **"Why: compression is lossy"** — the §3 trade-off table; "summarization, not
  storage."
- **"This doesn't contradict their benchmarks"** — the §4 scale point (pre-empts
  pushback).
- **Caveats** — §5, shown plainly.

**Verbatim line for the climax slide:**
> *"Blockify trades recall for compression. On a large, repetitive knowledge base
> that's a win. On a small document it's all cost and no benefit — and it can
> silently lose the exact fact you need."*

---

## 7. Honest bottom line for the deck

Across every test — clean release notes **and** a redundant knowledge base — **naive
RAG won or tied, and Blockify demonstrated data loss on small documents.** The
credible, defensible conclusion is a **fit statement**, not a takedown:

- **Use naive RAG** for small/medium corpora and any "recover the exact fact" need.
- **Consider Blockify** only for large, highly-redundant knowledge bases where dedup
  and token efficiency matter — and even then, validate recall, because distillation
  is lossy by design.

The value of this POC was never to crown a winner. It was to **measure**, fairly,
and report the truth — including the parts that don't match the marketing.
