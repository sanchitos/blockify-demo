# Presentation Brief — UPDATE 2 (supersedes the experimental detours)

> **Read order:** `PRESENTATION_BRIEF.md` → `PRESENTATION_BRIEF_UPDATE.md` → **this file**.
>
> **What this update decides:** we are **settling on the simple k=6 baseline** for
> the POC and the presentation, and explaining clearly what happens there — instead
> of continuing to tune knobs. Update 1 chased fixes (k=12, tag-enrichment, a
> "list everything" instruction); each one *moved the problem* rather than solving
> it and made the story harder to tell. This file explains why we stopped and what
> the clean, final narrative is.
>
> **If your deck already incorporated Update 1:** trim the k=12 / enrichment /
> completeness-instruction material down to a single optional "we tried tuning and
> here's why we stopped" slide (see §4). The headline comparison should be the
> simple k=6 one.

---

## 1. The configuration we're presenting (final, simple)

- **top-k = 6** for both pipelines.
- **Identical answering prompt**, model (`gpt-4o-mini`), and temperature (0.4) for
  both — the only variable is what was retrieved.
- **Blockify context** fed to the model is just `name: trusted_answer` (no tag
  enrichment).
- No special "list everything" instruction.

This is the original, minimal setup. The code is back to this state in
`src/app/api/ask/route.ts`.

---

## 2. The result we're explaining

Question: **"List every change in the D360 2.17.0 release."** (~12 changes in the doc)

| | Blockify (IdeaBlocks) | Naive (raw chunks) |
|---|:--:|:--:|
| Items listed | **~6 of 12** | **~12 of 12** |
| Preserved doc structure | No | Yes (kept section headers) |

**On this question, naive is the more complete answer.** That's the honest result,
and the POC is designed to surface exactly this kind of truth.

---

## 3. What is actually happening (the one clean explanation)

It comes down to **one idea: retrieval-unit size interacts with top-k.**

- **Naive** turns this short 2-page doc into only **~5 large chunks**, each ~1,000
  characters packing *several* changes together. At k=6, it retrieves **all of
  them** → the model sees the *entire document* → complete list. The chunks also
  still contain the document's section headers, so the answer stays organized.
- **Blockify** turns the same doc into **~12 atomic IdeaBlocks**, one change each.
  At k=6, it retrieves only **6 of the 12** → half the changes never reach the
  model → the list is truncated to ~6.

> **The line to say on stage:** *"Same k, but the units are different sizes. Six fat
> chunks cover the whole short document; six atomic facts cover only half of it.
> Granularity and top-k are coupled."*

That's the whole lesson. It's simple, it's true, and it doesn't require any of the
extra machinery.

### Why this is the *right* place to stop
- It's **one concept**, easy to draw on a slide (6 big boxes vs. 12 small boxes,
  k=6 cutoff line).
- It avoids the rabbit hole we went down in Update 1, where "fixing" retrieval just
  exposed a generation problem, and "fixing" generation with a prompt didn't work.
  Those are real and interesting, but they make the POC and the talk *more complex
  for little payoff*.

---

## 4. (Optional) one slide: "why we didn't just tune it"

If asked "couldn't you just raise k or change the prompt?", the honest one-slide
answer — keep it brief, this is a footnote, not the story:

- **Raise k to 12** → Blockify retrieves all 12 blocks, but the model then *answers
  only the top 2–3 by similarity*. The bottleneck **moved from retrieval to
  generation**.
- **Add "list every item" to the prompt** → still ~2–3. Prompt patching didn't fix
  it, because the distilled facts lack the document's structural "this is a list"
  cues that the raw chunks keep.
- **Conclusion:** more knobs moved the problem around without a clean win, and added
  complexity. For a clear POC, the k=6 comparison tells the real story by itself.

(One nuance worth a sentence if the audience is technical: Blockify's 1-block-per-
fact structure *could* enable reliable, deterministic enumeration — block count =
answer count — which naive can't do. But exploiting that means building
enumeration-aware logic, which is out of scope for this POC.)

---

## 5. The honest takeaways for the deck (unchanged and reinforced)

1. **Match retrieval-unit size and top-k to your corpus and question type.**
   Fine-grained units need a higher k for "list everything" questions; coarse chunks
   already cover small documents.
2. **This 2-page, single-doc test is close to Blockify's worst case** — nothing to
   dedupe, no noise to cut through, tiny corpus. It cannot show Blockify's intended
   strengths.
3. **Where Blockify is built to win** (still to be tested): needle questions in
   large/noisy documents, and big, redundant corpora where deduplication and token
   efficiency matter.
4. **Measure, don't assume.** A side-by-side harness lets you see where RAG breaks
   for *your* data instead of trusting a vendor benchmark.

---

## 6. Suggested final demo flow (simple)

1. Upload the D360 release-notes PDF — show "Blockify: ~12 IdeaBlocks · Naive: ~5
   chunks." (This single line already previews the whole explanation.)
2. Ask **"List every change in the D360 2.17.0 release."** → Blockify ~6, naive ~12.
3. Explain with the §3 picture: 6 big boxes vs. 12 small boxes, k=6 cutoff.
4. (Optional) ask a **needle** question — *"What email do separation emails go to?"*
   — to show the flip side where atomic blocks are precise.
5. Close on the §5 takeaways.

**Stop tuning. The k=6 comparison is the presentation.**
