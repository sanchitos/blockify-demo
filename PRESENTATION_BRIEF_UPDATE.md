# Presentation Brief — UPDATE / Addendum

> **Read this alongside `PRESENTATION_BRIEF.md`.** It extends the story with a
> later experiment that produced a sharper, more surprising finding. If the deck
> already exists, this is the material to *fold in* — see §5 for exactly which
> slides to add or amend.
>
> **The headline:** once we fixed the retrieval problem, the failure didn't go
> away — it *moved* to the generation step. That decoupling is the single most
> valuable lesson in the whole demo.

---

## 1. What changed since the original brief

After the first comparison (where naive "won" the coverage question at top-k = 6),
we made two changes to the Blockify side:
- **Raised default top-k from 6 → 12** so fine-grained blocks aren't truncated.
- **Enriched the Blockify context** fed to the model with each block's `entity`
  and `tags` (structured category metadata), not just name + answer.

Then we re-ran the same coverage question:
> *"List every change in the D360 2.17.0 release."*

---

## 2. The new result (the surprising one)

**Retrieval was now perfect.** All **11 IdeaBlocks** — every distinct change in the
document — were retrieved and present in the context.

**The answer still listed only 3 changes.**

And not a random 3 — it wrote up **exactly the top 3 blocks by similarity score**
and silently dropped the other 8:

| Rank | Block | Similarity | Appeared in answer? |
|---|---|:--:|:--:|
| 1 | Driver Status / HOS tab | 0.51 | ✅ |
| 2 | Drag & drop tabs | 0.47 | ✅ |
| 3 | Safety Coach Observations | 0.36 | ✅ |
| 4 | Annual Review notification | 0.35 | ❌ |
| 5–11 | Auditor update, 1x1 stats, Safe Miles, Case locking, Stage labels, Separation emails, Accident Review | 0.34 → 0.16 | ❌ |

Meanwhile **naive** (same prompt, same model, same temperature, ~5 fat chunks)
enumerated **all ~12 changes, neatly grouped by section** (Enhancements / Bug
Fixes / Permissions).

---

## 3. Why this happened (the core insight)

**The bottleneck moved from retrieval to generation.**

- At **k=6**: retrieval was the limit — only half the blocks reached the model.
- At **k=12**: retrieval was *solved* — all 11 blocks were in context — but the
  **model itself** chose to write up only the 3 highest-scoring ones. It used the
  similarity ranking as an **editorial relevance filter the user never asked for.**

**Why naive didn't do this, with the identical prompt — it's about context shape:**
1. **Naive chunks are fat and self-evidently "lists of changes,"** and they still
   contain the document's section headers ("ENHANCEMENTS", "BUG FIXES"). Even a
   low-similarity chunk obviously screams "enumerate these," so the model does.
2. **The distilled blocks read like a pre-ranked menu** — 11 tidy, scored one-liners
   — so the model feels licensed to pick the "best" few instead of reproducing all.

> Paradox worth saying out loud on stage: the *messier* raw-document format was a
> **stronger cue to "list everything"** than the clean, pre-distilled list.

**Two takeaways for the audience:**
- **Retrieval ≠ generation. They fail independently.** "All the facts are in the
  context" does **not** guarantee "all the facts are in the answer."
- **Context *format* shapes model behavior**, not just context *content*.

---

## 4. Two honesty caveats to keep on the slide

- **This is a single stochastic sample.** At temperature 0.4 the same question gave
  6 changes on one run and 3 on another. A real evaluation runs each question
  several times and reports the distribution — never a single screenshot.
- **The fix we applied (below) is a prompt patch, not a Blockify property.** It
  helps both pipelines equally. It does not make Blockify "better than" naive; it
  removes a generation artifact that was masking the retrieval comparison.

---

## 5. How to fold this into the existing deck

Add/adjust these slides:

- **Amend the "coverage question" slide (was slide ~7):** show the *progression*,
  not a single verdict:
  1. k=6 → Blockify truncated (6 of 12); naive complete. *Retrieval-limited.*
  2. k=12 + enriched → Blockify retrieves all 11… but answers only 3.
     *Now generation-limited.*
- **New slide — "The bottleneck moved":** the similarity table from §2. Punchline:
  *"Retrieval was perfect. The model still dropped 8 of 11 facts."*
- **New slide — "Why: context shape, not just content":** the two bullets from §3
  (fat chunks cue enumeration; pre-ranked list invites cherry-picking).
- **Amend the takeaways slide:** add "Retrieval and generation fail independently"
  and "Context format shapes generation."
- **Amend the caveats slide:** add the single-sample / stochasticity point.

**Suggested one-liner for the deck:** *"Better retrieval exposed a worse problem —
the model was quietly editing our facts for us."*

---

## 6. The fix we applied (for the appendix / "what we did next")

Added a **completeness instruction** to the shared answering prompt
(`src/app/api/ask/route.ts`), applied identically to both pipelines:

> *"If the question asks you to list or enumerate (e.g. 'list every…', 'what are
> all…'), include EVERY relevant item from the reference information — do not
> summarize, rank by relevance, or omit items."*

Expected effect: on enumeration questions the Blockify side should now reproduce all
retrieved blocks (and, thanks to the earlier `tags`/`entity` enrichment, organize
them by category). Re-run the question live to capture the "after" screenshot.

**Note:** this lives in the prompt, so it benefits naive too — keep that explicit so
no one mistakes it for a Blockify capability.

---

## 7. Revised bottom line

The demo's value was never "Blockify wins." It's that **a fair, side-by-side harness
lets you watch where RAG actually breaks** — and that the break point *moves* as you
fix things: from retrieval (too few chunks) → to generation (model cherry-picks from
enough chunks) → to prompt design (enforce completeness). Match the strategy — and
the prompt, and the top-k — to your corpus and your question types, and *measure* it
rather than trusting any single run.
