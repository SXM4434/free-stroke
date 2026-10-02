# Research — Timing system, layer stack, and stack animation

Sources consulted while building `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1`,
`POST_MVP_LAYER_STACK_PHASE_1`, and `POST_MVP_STACK_ANIMATION_PHASE_1`.

These three phases leaned less on external technique than the renderer phases
did — the interesting decisions were architectural rather than mathematical —
so this doc is shorter, and honest about which ideas came from prior art versus
from the project's own constraints.

---

## 1. Porter–Duff compositing and separable blend modes

**Links:**
- https://ssp.impulsetrain.com/porterduff.html (Søren Sandmann Pedersen)
- https://www.sarasoueidan.com/blog/compositing-and-blending-in-css/ (Sara Soueidan)

**What it is.** The standard model for combining layered images. Porter & Duff's
1984 SIGGRAPH paper "Compositing Digital Images" defined the twelve operators
for combining images by their alpha; modern specs (CSS, SVG, PDF) layer a set of
*blend functions* on top of that.

**What it does.** Two things we needed:

1. **The separable blend formulas**, exactly. Multiply is `base × layer`, and
   because both operands are ≤ 1 the result is *always at least as dark* as
   either input — it can only darken. Screen is the mirror image:
   `1 − (1 − base)(1 − layer)`, which inverts, multiplies, and inverts back, so
   it can only lighten. That complementarity is precisely why these two are the
   right first pair to ship rather than, say, overlay and soft-light.
2. **The ordering convention** — blending happens first, then the compositing
   step. Our `fsStackBlend` follows that shape: compute the blended colour, then
   `mix()` back toward the base by the layer's amount.

**What we used it for.** `STACK_BLEND_GLSL` in `lib/style-stack.ts`. We
deliberately implemented only the separable modes that need no alpha
bookkeeping, since every Free Stroke layer is opaque and operates on the same
fragment — the full Porter–Duff operator set would be machinery without a
purpose here.

**Where we stopped short.** No overlay, soft-light, or the non-separable
(hue/saturation/colour/luminosity) modes. Those are worth adding when there is
a real use for them; shipping a long menu of blend modes nobody has a reason to
pick is the "random sliders" failure the PRD warns about.

---

## 2. Group animation: Photoshop layer groups / After Effects precomps

**What it is.** Not a technical source — a well-established *interaction model*
that the PRD names directly ("similar to a Photoshop layer group, an
Illustrator group, an After Effects precomp, a grouped effect stack").

**What it does conceptually.** A group is a container you can transform and
animate as a unit, while its contents keep their own independent settings. The
crucial property: transforming the group preserves the *relative* relationships
inside it. Fading a group down does not rearrange which layer dominates.

**What we used it for.** It is the entire specification for stack animation. The
implementation follows the model literally: the group produces an `amount` and a
`timeOffset` that apply **uniformly** to every layer. That uniformity is what
makes a preset tuned "ASCII dominant at 0.85, others supporting at 0.3" arrive
*as that composition* rather than reassembling itself during the fade.

It also draws the line against fusion: a group transform never lets one layer
*influence* another. Layers moving together is stack animation; layers driving
each other's parameters is fusion, and keeping those separate is what stops the
system collapsing into "everything affects everything."

---

## 3. Easing and motion timing — `emil-design-eng` skill

**What it is.** Sebs's own animation decision framework (`~/.claude/skills/emil-design-eng`).

**What we used it for.** Every duration and curve call across these phases, and
notably the judgment that **decorative, rarely-seen, expressive canvas motion
may be much more present than UI-chrome motion.** That distinction is what
justified roughly doubling the animated-texture rates during the craft pass — a
timing that would be obnoxious on a menu is correct on an authored art object.

The framework's "use custom easing curves, the built-in ones are too weak" rule
also drove the logo-flip retiming recorded in `LOGO_CAPTURE_VARIANTS…` and the
`easeInOutCubic`/blended-sine curves in `scripts/capture/compose.mjs`.

---

## 4. The findings that came from no source

Three decisions in these phases have no prior art behind them — they came out of
this project's own constraints, and are documented in the explainers rather than
borrowed:

- **Completion must be detected on the boundary crossing**, not by testing
  `reveal >= 1` each frame, or a parked playhead retriggers one-shots forever
  and replay never re-arms. (`04-timing-system.md` §3)
- **A one-shot needs a cutoff well above the visible floor.** An exponential
  decay with a tiny cutoff never actually stops; it creeps at ~10% for many
  seconds and is measurably still animating. (`04-timing-system.md` §4)
- **Time-based effects need an explicit origin, and "scene start" is almost
  never it.** A fade measured from scene start has always already finished by
  the time a user enables it. (`06-stack-animation.md` §4)

The second and third are the same mistake in different clothes, which is why
it is written down.

---

## No visuals saved from these sources

All text/spec references. The visual record is `docs/verification/timing-v1/`,
`stack-v1/`, and `stack-anim-v1/`.
