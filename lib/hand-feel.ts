/* ============================================================================
 * HAND-FEEL PRIMITIVES — PORTED FROM DESK DOODLES
 *
 * PROVENANCE
 *   ~/Desktop/Projects/desk-doodles/src/app/lib/handFeel.ts
 *     · seededRandom            (:29)
 *     · jitter                  (:37)
 *     · ShapeModifiers          (:42)
 *     · PROTRUDE/OVERSHOOT/KINK (:51-53)
 *     · HAND_FEEL_BASE          (:421)  — the LOCKED sacred ratios
 *     · EXCALIDRAW_WARN_THRESHOLD (:437)
 *   ~/Desktop/Projects/desk-doodles/src/app/components/canvas/SvgStyleTransform.tsx
 *     · effectiveWobble         (:557)  — the size-aware clamp
 *
 * WHY THIS FILE EXISTS
 *   Free Stroke had NO hand-feel layer at all. A grep for
 *   `wobble|jitter|seededRandom|handFeel` across lib/ components/ app/ scripts/
 *   returned only shader dot-jitter and prose. The strokes fed to the 3D
 *   engines come from `scripts/capture/letters.mjs`, a mathematically exact
 *   single-stroke vector font (`A: L([6,0],[37,-CAP],[68,0])` — three integer
 *   points), and `stroke-processing.ts` then Taubin-smooths and arc-length
 *   resamples them, which makes them MORE exact, not less. Every stage before
 *   the geometry removed hand. That is why the render reads as "some stupid
 *   machine wrote it": a machine did write it.
 *
 *   Desk Doodles' own doctrine, verbatim:
 *     "Seeded wobble is authored; unseeded wobble is noise."
 *        — docs/knowledge/09-systems-thinking.md:82
 *     an engineering choice that is "premium but lifeless (perfectly uniform
 *     output with no hand in it) — gets killed."
 *        — same file, :84
 *
 * WHAT PORTS VERBATIM vs WHAT WAS CONVERTED
 *   Desk Doodles calibrated these constants against an 800x600 viewBox holding
 *   shapes 60-300px. Free Stroke's stroke space is the same order: the capture
 *   canvas runs to ~800x600 (geometry-baseline shapes span x 120-740, y
 *   260-500) and the hero word is laid out at FONT_TARGET_W=1100 with a ~100px
 *   cap height (app/desk-doodles/page.tsx:135). Per-glyph bboxMin therefore
 *   lands at 70-100px, squarely inside the band these numbers were tuned for.
 *   So EVERY constant here ports VERBATIM — no px rescaling. (Contrast the 3D
 *   side, where Desk Doodles' own porting rule at strokeTo3d.ts:116 requires
 *   absolute world lengths to be scaled by 8/3. That rule applies to world
 *   units, not to the viewBox-space stroke coordinates this file operates on.)
 *
 *   Changed to make it run here: none of the maths. Only the module shape —
 *   Desk Doodles' file also exports rough.js-style SVG *path builders* that
 *   depend on `perfect-freehand`, which Free Stroke does not carry and does not
 *   need (Free Stroke renders 3D geometry, never an SVG `d` string). Those
 *   builders are deliberately NOT ported; the primitives they were built on are.
 * ========================================================================== */

/* ------------------------------------------------------------------ */
/*  Seeded RNG — handFeel.ts:29, verbatim                             */
/*                                                                    */
/*  Determinism: every helper uses a seeded LCG (linear congruential  */
/*  generator) so the rendered output is stable across page loads —   */
/*  required for the screenshot pipeline. (Their comment, :13-15.)    */
/*  Free Stroke has the identical requirement: scripts/capture and    */
/*  scripts/verify diff frames across runs, so an unseeded wobble     */
/*  would make every verification run fail against itself.            */
/* ------------------------------------------------------------------ */
export function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function jitter(rand: () => number, amp: number) {
  return (rand() - 0.5) * 2 * amp
}

/* ------------------------------------------------------------------ */
/*  Endpoint treatment — handFeel.ts:42-53                            */
/* ------------------------------------------------------------------ */

/** Endpoint corner treatment. Desk Doodles' `ShapeModifiers.endpointBehavior`
 *  (handFeel.ts:44), reduced to the axis that applies to a freehand polyline.
 *
 *  This is a real hand signature and it is very visible on letterforms: a hand
 *  does not stop exactly on the mark. It overshoots. Desk Doodles kept `kink`
 *  alive specifically because it is geometrically distinct from `protrude` —
 *  see their post-lock ruling R-1 (09-LOCKED-MODEL.md:393): "code verification
 *  2026-06-10 found the Day 9 drawn-canvas overhaul made it genuinely
 *  distinct: `applyEndpointBehavior` gives kink a random-angle push at EVERY
 *  anchor while protrude remains a structured endpoint extension — different
 *  geometry classes in all live render paths." */
export type EndpointBehavior = "clean" | "protrude" | "long-overshoot" | "kink"

/** px — corner overshoot for 'protrude'.        handFeel.ts:51 */
export const PROTRUDE_AMOUNT = 4
/** px — heavy overshoot for 'long-overshoot'.   handFeel.ts:52 */
export const LONG_OVERSHOOT_AMOUNT = 9
/** px — kink offset (random angle) for 'kink'.
 *  NOTE the sanctioned divergence: handFeel.ts:53 uses 5, but the Hero-8-Lab
 *  fork reduced it to 2.5 because a random-angle push "reads as MORE dramatic
 *  than radial push (regular vs chaotic visual)" — f3HandFeel.ts:54-61, quoting
 *  Sebs 2026-06-04: "each corner should be kinked but not as much as we have it
 *  now." SvgStyleTransform.tsx:736 uses the 2.5 value, and that is the one in
 *  the live render path, so 2.5 is what ports. */
export const KINK_AMOUNT = 2.5

export function endpointAmountFor(mode: EndpointBehavior): number {
  return mode === "protrude"
    ? PROTRUDE_AMOUNT
    : mode === "long-overshoot"
      ? LONG_OVERSHOOT_AMOUNT
      : KINK_AMOUNT
}

/* ------------------------------------------------------------------ */
/*  Per-shape base calibration — handFeel.ts:404-432, VERBATIM        */
/* ------------------------------------------------------------------ */

/**
 * LOCKED PER-SHAPE BASE CALIBRATION — DO NOT DRIFT.
 *
 * These values are SACRED RATIOS calibrated in the playground. They define the
 * relative jitter amplitude across primitive types so a "wobbly rect" reads
 * proportionally to a "wobbly line" in the same artifact.
 *
 * The master `wobble` slider (F3ModifiersState.wobble, 0-2) multiplies ALL
 * five values together — preserving the rect:oval:diamond:line:orthogonal
 * proportion while scaling overall jitter. Per `09-LOCKED-MODEL.md` I-11.
 *
 * NEVER change individual values in isolation. Changing one shifts the
 * proportion and breaks the playground's calibrated read. If you need to
 * shift global jitter, change `wobble` in state (or its slider range);
 * if you need to change per-shape character, document why and update ALL
 * five values to preserve the ratio mapping.
 *
 * ── Free Stroke note ──
 * Every stroke in this app is a freehand polyline, so `line` (1.4) is the
 * base that applies. The other four are carried across unchanged rather than
 * dropped, because the block above is explicit that the RATIO is the locked
 * artifact — deleting four of the five would destroy the thing being locked,
 * and a future Free Stroke primitive (a snapped rect, an assisted oval) must
 * land on the same ladder rather than inventing a second calibration.
 */
export const HAND_FEEL_BASE = {
  /** Box-shape edges (rectangles, rounded rects). */
  rect: 2.4,
  /** Oval / capsule edges. */
  oval: 2.4,
  /** Diamond polygon edges. */
  diamond: 2.0,
  /** Single straight forward edges (between nodes). */
  line: 1.4,
  /** Orthogonal multi-segment paths (loopbacks). */
  orthogonal: 1.6,
} as const

/** Multiplier above which we visually warn — enters Excalidraw signature zone.
 *  Threshold for the master `wobble` slider (per I-11). Chrome shows a warn
 *  styling when `wobble > EXCALIDRAW_WARN_THRESHOLD`.  handFeel.ts:434-437 */
export const EXCALIDRAW_WARN_THRESHOLD = 1.4

/* ------------------------------------------------------------------ */
/*  Size-aware wobble clamp — SvgStyleTransform.tsx:557-571, VERBATIM */
/* ------------------------------------------------------------------ */

/** Wobble clamp — same size-aware logic as effectiveRoughness, applied to the
 *  master wobble multiplier. Playground (C3UserFlow) content is 100-300px so
 *  the unclamped wobble * HAND_FEEL_BASE works there. Trophy Wall pins are
 *  60-80px so the same amplitude reads as shredded. Clamp so wobble's effect
 *  scales with shape size — small pins get muted wobble, big content gets full. */
export function effectiveWobble(userWobble: number, bboxMin: number): number {
  // Floor 0.3 → 0.5 (2026-06-08 quick fix per Sebs): simple shapes (stick
  // figure, simple pen) were getting too clamped at default rough-handdrawn
  // (geomean of tiny bbox ⇒ wobble ≤ 0.3). 0.5 floor lifts the baseline so
  // every shape reads as visibly hand-drawn at default without re-shredding
  // small geometry (the geomean clamp + min-with-userWobble still bound it).
  // Real fix = smart-layer per-element role classifier; this is the interim.
  const maxUseful = Math.max(0.5, bboxMin / 60)
  return Math.min(userWobble, maxUseful)
}

/* ------------------------------------------------------------------ */
/*  Style presets — SvgStyleTransform.tsx:49-83, the wobble column     */
/* ------------------------------------------------------------------ */

/**
 * The master wobble value each Desk Doodles style ships at, lifted from their
 * STYLE_PRESETS table so Free Stroke lands on the SAME calibration rather than
 * a number someone eyeballed here.
 *
 * Their calibration comments, verbatim (SvgStyleTransform.tsx:50-51, :69-78):
 *
 *   "Non-rough styles set wobble: 0 (clean baseline; jitter inactive).
 *    Rough-family styles set wobble: 1.0 (playground calibration baseline per I-11)."
 *
 *   "wobble 1.0→0.4 + curveDamp 0.4→0.3 per Sebs 2026-06-11 ('start at these
 *    values') — calmer default line; full range still reachable on the sliders."
 *
 * So 0.4 is not a guess: it is the value Sebs personally settled the
 * rough-handdrawn default on, after it had been 1.0. `clean` at 0 is what
 * keeps the existing Free Stroke behaviour reachable byte-identically.
 */
/**
 * The ink weight Desk Doodles' wobble amplitude was calibrated AGAINST.
 *
 * Their `rough-handdrawn` preset ships `strokeWidth: 1.2`
 * (SvgStyleTransform.tsx:70) and, at that preset's `wobble: 0.4`, an amplitude
 * of `HAND_FEEL_BASE.line * 0.4 * 2 = 1.12px`. So the wobble excursion is
 * roughly EQUAL TO the width of the line carrying it. That ratio — not the
 * absolute pixel value — is what reads as a hand.
 *
 * THIS IS THE CORRECTION TO A FIRST-PASS PORT THAT LOOKED RIGHT AND WASN'T.
 * Ported verbatim as an absolute px value, the wobble was measurably present
 * and visually invisible: Free Stroke's Inflate tube is ~9px in the same
 * coordinate space where Desk Doodles' line is 1.2px, so a 1.12px excursion
 * disappeared INSIDE the tube. Frames at wobble 0, 0.4, 0.8 and 1.2 were
 * near-identical (docs/verification/handfeel/crop_w*.png, first run).
 *
 * Desk Doodles states the rule themselves, at strokeTo3d.ts:116-122, when they
 * ported Free Stroke's rod constants in the other direction:
 *
 *     "All ABSOLUTE world lengths convert x8/3; radius-RELATIVE factors port
 *      verbatim."
 *
 * Wobble amplitude is an absolute length, so it converts. It converts by the
 * ratio of ink weights, because ink weight is what it is calibrated against.
 */
export const DD_REFERENCE_INK_WIDTH = 1.2

export const WOBBLE_PRESETS = {
  /** Desk Doodles `clean` — jitter inactive. Free Stroke's current behaviour. */
  clean: 0,
  /** Desk Doodles `rough-handdrawn` — Sebs's settled default. */
  roughHanddrawn: 0.4,
  /** Desk Doodles `sketchy` / `stipple` sit higher (0.6 / 0.8). */
  sketchy: 0.6,
  /** Desk Doodles `charcoal` — the playground baseline per I-11. */
  charcoal: 1.0,
} as const
