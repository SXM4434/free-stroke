# Free Stroke docs

## Start here

- **[PRD.md](PRD.md)** — the full project plan, phase map, and operating rules.
  Source of truth for *what* gets built and in what order.
- **`SESSION-HANDOFF.md`** (repo root) — what is *actually* done. The last
  checkpoint is current truth.

## Explainers

One doc per system: the code, the tech, the math, and the reasoning. Written for
a designer — graphics/shader/math concepts are explained from first principles;
design reasoning stays brief. Read in order; each builds on the last.

| | System | The interesting part |
|---|---|---|
| [01](explainers/01-procedural-texture.md) | Procedural texture | Why patterns are *computed* from position instead of wrapped from an image, and how value noise avoids grid seams |
| [02](explainers/02-dither.md) | Dither | Ordered dithering, the Bayer matrix generated arithmetically, and why a pattern that only edits colour is invisible on glossy black |
| [03](explainers/03-ascii.md) | ASCII | Drawing letters with no font, the float-precision trap, and why a near-black subject breaks brightness ramps |
| [04](explainers/04-timing-system.md) | Timing | One clock, six sync modes, and why a one-shot that never quite stops isn't a one-shot |
| [05](explainers/05-layer-stack.md) | Layer stack | Why texture structurally can't be reordered, and what "taste" looks like as numbers |
| [06](explainers/06-stack-animation.md) | Stack animation | Animating the group vs animating the layers, and why time-based effects need an explicit origin |

## Research

Every online source used while building, with what it is, what it does, and what
we used it for.

- [texture-phase.md](research/texture-phase.md) — shader injection, GLSL noise
- [dither-phase.md](research/dither-phase.md) — ordered dithering, Bayer, IGN
- [ascii-phase.md](research/ascii-phase.md) — bitfield glyphs, and the one
  finding no source covers (dark subjects)
- [timing-and-stack-phases.md](research/timing-and-stack-phases.md) —
  Porter–Duff blend formulas, the layer-group interaction model, and the three
  findings that came from no source at all

## Verification

`verification/<pass>/` holds the frames proving each build pass. This is the
standing rule made concrete: every edit that changes rendered output gets frames
captured *and looked at*, at high frame counts.

| Directory | What it shows |
|---|---|
| `texture-v1/` | 5 patterns × 4 modes, plus animated motion runs |
| `dither-v1/` | 5 threshold maps × 4 modes, plus matrix crawl and threshold sweep |
| `ascii-v1/` | 5 charsets × 4 modes, plus 4 animation behaviours |
| `timing-v1/` | each sync mode under conditions designed to expose it |
| `stack-v1/` | progressive layering, order, blend, opacity, and the 5 presets |
| `stack-anim-v1/` | each group behaviour, including freeze-on-complete |

## The tools

Run these with the dev server up (`pnpm dev`):

```bash
node scripts/verify/verify-style.mjs --pass=<name> --system=texture|dither|ascii
node scripts/verify/diff-frames.mjs  --pass=<name>   # reads / faint / too subtle
node scripts/verify/verify-gates.mjs                 # rebuild + export + taxonomy
node scripts/verify/verify-timing.mjs && node scripts/verify/assert-timing.mjs
node scripts/verify/verify-stack.mjs  && node scripts/verify/assert-stack.mjs
node scripts/verify/verify-stack-anim.mjs && node scripts/verify/assert-stack-anim.mjs
```

`verify-*` captures frames. `assert-*` and `diff-frames` turn them into pass/fail.
The split matters: capturing is cheap and rerunnable, asserting is where a claim
like "the pattern reads" or "the pulse is one-shot" gets settled.

## The build loop (per phase)

1. **Research** — search before writing code; save it to `research/`.
2. **Build** — smallest honest slice. Geometry stays locked.
3. **Verify with frames** — capture high-frame-count evidence and actually look
   at it, plus numeric assertions so nothing passes on vibes.
4. **Document** — an explainer, plus a checkpoint in `SESSION-HANDOFF.md`.
5. **Commit and push** to the PR branch.

## A pattern worth knowing

Four separate bugs this project hit were **correct code that rendered wrong**,
and none would have survived a frame check:

- a texture pattern invisible on glossy black (albedo-only modulation)
- ASCII rendering as empty space (near-black subject vs a 0–1 brightness ramp)
- a "one-shot" pulse that never actually stopped
- a fade-in that measured from scene start, so it had always finished before you
  enabled it

The last two are the same mistake in different clothes: **time-based effects need
an explicit origin, and "scene start" is almost never it.**
