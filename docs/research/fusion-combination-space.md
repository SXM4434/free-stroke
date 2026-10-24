# Research — the fusion combination space

What was read before authoring 120 relationship cells, what each source actually
says, and the specific decision it changed. Behind
[explainer 25](../explainers/25-the-power-set-of-fusion.md).

Anything below that only restates what our own code already does has been cut.
What is left is the material that told us something we did not know — plus, at
the end, the part **no source covers**, which is most of the hard half.

---

## 1 · The count, and why it is not 128

Sebs's ask was arithmetic before it was design:

> *"there should be a fusion for every possible combo… there's like 7 styles… so
> it would be like 2 to the power of 7."*

The seven are the style panel's own tabs — `material · animation · texture ·
dither · ascii · layers · fusion` (`components/style-panel-scaffold.tsx`,
`PANELS`, line 162). That array has **eight** entries; the one that is not a
system is `presets`, a picker for the other seven — and it sits **sixth**, not
last. Counted, it would have produced 2⁸−1−8 = **247** cells for a set that
answers a seven-way question. (Verified by enumerating the ids out of the file
rather than trusting the count: `material · animation · texture · dither ·
ascii · presets · layers · fusion`.)

A combination is a subset. Fusion is systems influencing **each other**, so:

```
2^7  −  1      −  7        =  120
128     empty      singles
```

21 pairs · 35 triples · 35 quadruples · 21 fives · 7 sixes · 1 that is
everything. His arithmetic was right; the answer to *"is there a fusion for
every combo"* is a set of 120 and nothing else.

**Four of the 120 can contain no picture, and that is arithmetic too.** Line the
21 fusion targets up against the seven systems: every target belongs to texture,
dither, ASCII or material. None belongs to animation, layers or fusion — those
three are *sources*. Clocks. So the four subsets made only of clocks
(`animation+layers`, `animation+fusion`, `layers+fusion`, all three) have nothing
to write to, and their frame is the identity frame by construction. They are not
weak cells to be padded out; they are cells with no picture in them, and they are
kept **in** the set as the negative control the product supplies for free.

## 2 · Membership is derived, never declared — and the reason is local

The obvious implementation writes `systems: ["texture","dither"]` on each cell by
hand. That is a hand-copied inventory, and this repo has been bitten by exactly
that **five separate times** — `scripts/verify/lib/inventories.mjs` exists
because of it. A hand-written table drifts silently the moment a link is edited
and nothing compares the two.

So membership is computed by one function, `systemsOfLinks(links)`, and the gate
requires it to reproduce each cell's own key for all 116 authored cells. A fusion
link is one sentence — **SOURCE drives TARGET by AMOUNT** — so a system is a
member exactly when it is one end of a sentence. Nothing about that can go stale.

**And substrate is not membership.** Two switches get turned on for reasons that
have nothing to do with what a relationship is *about*, and counting them would
make almost every cell claim systems it does not use: `motionMode` (the
substrate-level "may style animate" switch, set by every shipped fusion preset
including ones that animate nothing) and `layerStackEnabled` (switched on for any
composition with two or more screen layers, on `fusionWakePatch`'s own
measurement — **87.0 %** of the mark's inked area survives without a stack against
**96.6 %** with one). Legibility, not authorship.

## 3 · The interface half — what the literature actually calls this

**Source.** *ParamExplorer: A framework for exploring parameters in generative
art*, arXiv 2512.16529 — read directly.

**What it says**, verbatim from the paper: generative parameter spaces are
"high-dimensional and complex," which produces a **"combinatorial explosion"**;
within them, "aesthetically compelling outputs occupy only small, fragmented
regions"; and because of that complexity "artists typically rely on extensive
manual trial-and-error, **leaving many potentially interesting configurations
undiscovered**." Its answer is an *explorer* — "an interactive and modular
framework … that helps the exploration of parameter spaces in generative art
algorithms, guided by human-in-the-loop or even automated feedback."

**What we used it for.** Two things, and the second is the more useful.

1. It named the failure mode we were about to build. 120 pills is not an answer,
   it is a wall — and this panel has already lost its dials below the fold once,
   when nine pills wrapped to two lines (caught by `assert-fusion-ui.mjs`, not by
   eye). The literature's consistent answer to a combinatorial space is **state
   what you want and let the space collapse**, not browse-and-filter a flat list.

2. It told us our version of the problem is unusually easy, and why. The paper's
   explorer has to *build* a query interface because a generative art parameter
   space has no natural handles. **Ours already has one on screen**: the 120 are
   indexed by a 7-bit key whose bits are the tabs at the top of the same panel.
   So the picker is seven chips. Press Texture, Dither and Material and the cell
   for that combination is named underneath, with its concept, its relationships
   read back as sentences, and — where one exists — the shipped relationship that
   already answers the same address. We did not need to invent a query language;
   we needed to notice that the query was already the UI.

The flat grid is still one press away, grouped by how many systems each cell
fuses, because **a set you cannot see whole is a set you cannot judge**. That is
what the contact sheets are for, and it is the only place the eye can do its job.

### The counter-evidence for the flat list, and how far to trust it

The synth-preset community is the largest population that has actually lived with
"here are hundreds of presets, browse them." The recurring report is not kind.
A KVR Audio thread on preset overload carries the line *"If I'm honest I usually
find only 1 or 2 sounds that work when I browse through libraries — the rest
cater for your typical sounds,"* alongside complaints about browsers that are
"a scroll down list filled with a mish-mash of random genre type presets."

⚠ **Recorded as a SECONDARY quote, not a verified one.** It was surfaced by
search; the direct fetch of the thread was refused by this environment's network
policy, so nobody here has opened the page. A citation is a claim that evidence
exists, and in this one case the claim is unconfirmed. It is kept because it
agrees with the paper's mechanism rather than carrying the argument alone — if it
were the only support for the seven-chip decision it would have to be dropped.

## 4 · The part no source covers, which is most of the work

Everything above answers *how do you let someone reach 120 things*. None of it
answers the two questions that actually decided whether this set was worth
shipping, and searching for prior art on them came back empty:

**a · How do you prove a relationship you can select actually DOES something in
the state you select it in?** The literature measures *coverage* of a design
space, not *liveness* of a point in it. Our answer had to be built, and both ways
the obvious version fails were measured on this probe's own first three runs:

- a camera-driven cell filmed on a free-running turntable read **350.8 against
  349.5** — it was measuring three.js's specular response;
- a cell with an animated layer has a crawling screen underneath it, so an
  unlinked arm travels just as far: `animation+texture+ascii` read **160.8
  against 186.6** — the control *louder than the signal*.

So the question is asked at ONE MOMENT rather than across a window: hold the
camera, take three captures a short gap apart, toggle the LINK dial between the
first and second, and take the verdict on `signal − control` where the control
has the relationship switched off in **both** halves. That is strictly stronger
than a travel measure, because it also catches a **constant** push — a `reveal`
link on a finished mark sits at full deflection and never moves, which reads dead
to anything measuring change over time.

And it needed a **second channel**, because one is blind: 90 ms of ASCII scroll is
~1.7 device pixels and every glyph edge in the field moves, so by L1 the frame is
completely different whether or not anything is coupled. Twelve cells the model
says move read a net of **0.000** on L1 alone. On tone, `animation+dither` reads
**16.98 against a drift of 0.08**. The same lesson turns up again on the repaired
turntable, in the other direction: its L1 control is *louder* than its signal
(netL1 **−20.8**) and only tone sees the fix (netTone **+4.9**).

**b · How do you tell 116 ideas from one idea 116 times?** No source covers this
either, and the repo had already invented the measurement for its own screen
rails — **nearest-sibling distance** (explainer 15). It transferred, and it is
necessary. It is also **not sufficient**, which is the finding worth carrying:

> Pixels answer *do these look alike*. They cannot answer *are these the same
> idea*.

Measured: `Read Out` and `Wire Desk` were the same body, the same screen, the
same charset, three of four links verbatim and a restated concept sentence — one
idea twice by any reading — and their crops measure **38.30 apart**, against a
closest pair of 10.46 in the same run. A pixel gate was never going to find it.
So the duplicate question is asked twice, of two different things: on the crops
(`assert-fusion-combo-distinct.mjs`) and on the **authoring**
(`assert-fusion-combos.mjs` §9 — is a cell its one-member neighbour's composition
and wiring, plus a wire). Neither is the other's backstop.

## 5 · The rhythm risk, named rather than glossed

[`material-fusion-stack-timing-craft.md`](material-fusion-stack-timing-craft.md)
§5 records the exact way a set like this dies:

> *"Six of the eight fusion presets … are a bare continuous sine in the 0.9–3.0
> rad/s band with no hold, no anticipation and no lag between driver and driven.
> They are not too small … They are **rhythmically identical**, which is why
> turning one on and switching between them feels like nothing changed."*

What keeps 116 cells out of that trap is not the Drive dial, it is the
**drivers**: 69 distinct driver-sets across 116 cells, and only **three** cells
whose drivers are breath and drift alone. The rest run on a layer's own phase,
the stack's clock, the draw, the finish, or your hand — five rhythms that have
nothing to do with fusion's sine.

## Sources

- [ParamExplorer: A framework for exploring parameters in generative art — arXiv 2512.16529](https://arxiv.org/abs/2512.16529) — read directly; the combinatorial-explosion framing and the explorer-over-browser answer.
- [Interfaces for Design Space Exploration](https://www.researchgate.net/publication/364229519_Interfaces_for_Design_Space_Exploration) — surfaced, not opened; listed for the next pass rather than cited above.
- [V-Dream: Immersive Exploration of Generative Design Solution Space — arXiv 2006.11044](https://arxiv.org/pdf/2006.11044) — surfaced, not opened.
- [Harnessing Design Space: A Similarity-Based Exploration Method (IJAC 13:2)](https://papers.cumincad.org/data/works/att/ijac201513206.pdf) — surfaced, not opened; the similarity-based narrowing is the nearest published relative of our nearest-sibling distance and is the obvious next read.
- [KVR Audio — "too many synths too many presets = too much headache??"](https://www.kvraudio.com/forum/viewtopic.php?t=531824&start=15) — ⚠ **quote surfaced by search, page NOT fetched** (network policy refused it). Secondary, corroborating only.
- In-repo: [explainer 15](../explainers/15-screen-layer-quality.md) (nearest-sibling distance) · [explainer 02](../explainers/02-dither.md) (why a threshold screen dies on a bright body) · [`material-fusion-stack-timing-craft.md`](material-fusion-stack-timing-craft.md) §3 and §5.
