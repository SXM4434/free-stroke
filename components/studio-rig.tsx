"use client"

/**
 * STUDIO RIGS — the two lighting setups a register can wear.
 *
 * ============================================================================
 * PROVENANCE
 * ============================================================================
 *
 * `STUDIO_ENV`, `StudioRig`, `applyRimGlow`, `CONTACT_SHADOW` and
 * `CONTACT_SHADOW_DROP` below are PORTED — copied, not re-derived — from
 *
 *     desk-doodles/src/app/components/canvas3d/Stroke3DScene.tsx
 *     (STUDIO_ENV ~L156, StudioRig ~L190, applyRimGlow ~L312,
 *      CONTACT_SHADOW ~L352, the <ContactShadows> usage ~L1802)
 *
 * read from the canonical clone at ~/Desktop/Projects/desk-doodles. Every
 * number and every comment is carried over intact, because those comments are
 * the record of measured failures — the tan flood that came back through the
 * specular channel, the rim strength that washed the body grey, the sheen-lobe
 * mirror that read milk-chocolate on a flat slab. Re-typing the values without
 * the comments would destroy the only explanation of why they are what they
 * are. Do not "clean them up".
 *
 * WHAT CHANGED TO MAKE IT RUN HERE — exhaustively, so the diff against Desk
 * Doodles stays auditable:
 *
 *  1. Import paths + `"use client"`. Desk Doodles is Vite; this is Next.
 *
 *  2. `applyRimGlow` CHAINS instead of assigning. A three.js material has
 *     exactly one `onBeforeCompile` and one `customProgramCacheKey`. In Desk
 *     Doodles the rim is the only consumer of both. Here `applyStyleShader`
 *     (lib/style-shader.ts) already owns them for the texture/dither/ASCII
 *     layers, so a verbatim assignment would silently delete the entire style
 *     stack. The GLSL string, the uniform names, the three values and the
 *     cache-key composition are byte-identical to Desk Doodles'; the only edit
 *     is that the previous hook is invoked first and the previous cache key is
 *     prefixed. Injection ORDER is preserved: the style shader replaces
 *     `#include <dithering_fragment>` with `<dithering_fragment>` + its stack
 *     code, so the rim's own replace still lands immediately BEFORE the
 *     include — exactly where Desk Doodles puts it.
 *
 *  3. `lite` is never passed. In Desk Doodles it exists because a desk flips
 *     many object canvases at once and N simultaneous Environment bakes crash
 *     the GL context. Free Stroke renders one canvas, so the Environment
 *     always bakes — skipping it would change the captured look for no gain.
 *     The prop is kept so the ported component stays identical to its source.
 *
 *  4. `dimFill` is never passed either: it is the svg-port sparse-legibility
 *     trim, and Free Stroke has no svg-port style. Kept for the same reason.
 *
 *  5. `StudioContactShadow` wraps Desk Doodles' `<ContactShadows>` usage so
 *     the props stay in one place. `CONTACT_SHADOW` and `CONTACT_SHADOW_DROP`
 *     are verbatim and every value they carry is used unchanged. Two props
 *     that Desk Doodles leaves at drei's default had to move — `near` and
 *     `frames` — because both defaults silently produce an EMPTY pool under
 *     this app's framing and its animated draw-in. Each is measured and
 *     explained at the component. A `minY` fallback is added as well, because
 *     Free Stroke's `StrokeBounds` carries a bounding SPHERE radius where Desk
 *     Doodles' carries the box minimum.
 *
 *  6. ONE VALUE IS NO LONGER DESK DOODLES': `applyRimGlow`'s `uRimColor`,
 *     `#fdf6ea` → `#f7f7f7` (2026-08-04, luminance-matched). The reasoning and
 *     the measurement that forced it are at the line itself. Listed here as
 *     well because the header's promise is that the diff against Desk Doodles
 *     stays auditable, and a value deviation is the kind a reader would
 *     otherwise never look for in a file that says it is a verbatim port.
 *
 * `FreeStrokeRig` is this app's OWN existing rig, lifted verbatim out of
 * components/viewport-3d.tsx (its `<ambientLight>`/`<directionalLight>` block
 * and its nine-Lightformer `<Environment>`) so that switching registers is a
 * choice between two real rigs rather than two parameterisations of one. Its
 * comments are its own and are likewise untouched.
 */

import * as THREE from "three"
import { Environment, Lightformer, ContactShadows } from "@react-three/drei"

/* ========================================================================== */
/*  DESK DOODLES — ported verbatim                                            */
/* ========================================================================== */

/** One Lightformer panel. */
export interface StudioPanel {
  color: string
  intensity: number
}
/** The baked `<Environment>`'s palette. Typed rather than `as const` since
 *  2026-08-04 so the SHIPPED table and the PARKED prior are the same shape and
 *  a resolver can return either. No consumer read the literal types. */
export interface StudioEnvPalette {
  bg: string
  key: StudioPanel
  rim: StudioPanel
  fill: StudioPanel
  streak: StudioPanel
}
/** The scene lights that sit outside the `<Environment>`. `dim` is the
 *  svg-port `dimFill` trim's alternate intensity for the three lights that
 *  have one. */
export interface StudioDirectLights {
  ambient: { intensity: number; dim: number }
  hemi: { sky: string; ground: string; intensity: number; dim: number }
  key: StudioPanel
  cool: StudioPanel
  bounce: StudioPanel
  point: { color: string; intensity: number; dim: number }
}

// ── Studio environment palette (named register — ink-black policy) ─────────
// The baked <Environment> is what clearcoat/envmap channels REFLECT, and
// specular reflection bypasses albedo — so any hue here lands on the object
// at full strength regardless of the ink-black base color. Values live in ONE
// named table so the material battery (tools/3d/material-battery) asserts
// against the exact rig the product ships.
//
// RATIFIED COLOR POLICY (3d-mode-controls-spec footer, Sebs 2026-06-12):
// everything renders as the single warm-graphite ink; presets differ ONLY in
// how light sits. Broad warm-TAN area bands are banned at every orbit angle
// (round-7 verifier measured rgb(142,118,91) on a Glossy Extrude slab —
// reproduced by the battery at rgb(146,122,96), Δr−b 50). Root cause: the
// original port "warmed" this palette for the paper world — env bg #8a8174
// (mid warm grey) + fill #ffd9b0 (Δr−b 79) re-entered through clearcoat/
// envmap ×1.8 as the tan flood. Same violation family as the sheenColor
// flood; same cure: re-register the hue-carrying channel to warm graphite.
//
// PROVENANCE: the Free Stroke calibration ancestor (origin/main
// viewport-3d.tsx, read via git show 2026-06-12) ran these EXACT material
// params against a NEAR-BLACK env bg (#15171a) + #ffffff key — dark bg is
// what the presets were tuned for (feedback_copy_implementation_before_
// tweaking_numbers). Panels keep their positions/intensities so clearcoat
// still has something to reflect (the Day-11 flat-black-blob bug was NO env;
// killing the panels would regress it).
// ── ROUND 3, 2026-08-04 — Sebs: *"the 3d version is also too brown, should
//    still feel black."* THIS IS A LAW VIOLATION, NOT A PREFERENCE. The
//    register's own note (lib/registers.ts) is *"One pencil. Matte ink, value
//    from light — never hue, never gloss."*
//
// WHAT ROUND 3 IS, AND WHY IT IS NOT WHERE THE BROWN TURNED OUT TO LIVE.
// Rounds 1 and 2 (above) de-warmed the env PANELS. Round 3 finishes the job on
// every remaining chromatic channel in the rig — the env background, the two
// whisper-warm panels, the cool rim panel, and the five DIRECT lights that no
// previous round had ever touched (`STUDIO_DIRECT`, below).
//
// But the attribution is measured, and it does not flatter this file.
// `_probe-brown-decile.mjs`, four arms on the real page at the beat's own
// `solid` playhead, eroded interior, brightest decile Δr−b head-on:
//
//     arm                                       brightest decile   whole form
//     SHIPPED (rig warm, ink #2A2622)                 23.92           16.82
//     rig's DIRECT lights neutralised                 21.57           14.82
//     INK neutralised, whole rig left warm             3.84            3.09
//
// **The ink was carrying ~84% of it.** Every warm light in this rig together
// carried about 2.4 of 23.9. So round 3 is real and it is not the fix; the fix
// is in `lib/style-system.ts`'s `deskDoodles.color` and its own comment carries
// the reasoning. Round 3 ships anyway because a light that supplies HUE is the
// banned channel whatever its share, and because every value below is
// LUMINANCE-MATCHED — the swap costs zero value, so there is nothing to trade.
//
// LUMINANCE-MATCHED means: each replacement grey has the same Rec.709 LINEAR
// luminance as the colour it replaces, so the panel's contribution to the
// form's VALUE is unchanged to the digit and only its hue is removed. That is
// the difference between de-warming and dimming, and rounds 1 and 2 both had
// to say "value/intensity kept" in prose because they had no such rule.
//
// ⚠ TWO MORE CHROMATIC VALUES LIVE IN THE VERBATIM PORT BELOW, AND THEY WENT
//    DIFFERENT WAYS. Both were measured rather than sorted by which file they
//    sit in:
//  · `applyRimGlow`'s `uRimColor` (#fdf6ea, Δ19) — REPLACED, and it is the only
//    port VALUE this file has ever deviated (header item 6). It reaches the
//    silhouette, and once the ink and the rig went neutral it was carrying
//    100% of the register's remaining chroma: `assert-register-light` reads the
//    DD form at p90 C* 1.40 with the rim on and 0.00 with it off. The rim's own
//    reasoning is at the line.
//  · `CONTACT_SHADOW.color` (#3a3128, Δ18) — KEPT. It is a pool on the PAPER,
//    not a channel on the form, and at opacity 0.32 over `#FDFCF9` it lands at
//    rgb(191,187,182) — Δr−b 9 against paper's own Δ4, i.e. it adds about 5 to
//    a surface that is warm by design. A shadow cast on cream paper is warm in
//    the real world too. Neutralising it would be tidiness, not law.
export const STUDIO_ENV: StudioEnvPalette = {
  /** Environment background — fills every direction the panels don't; it is
   *  what tilted glossy faces mirror BROADLY. Warm-axis sibling of the FS
   *  ancestor's #15171a, inside the D2-E ink family (#121110–#383632): broad
   *  reflections read as dark warm graphite, never tan.
   *  ROUND 3: `#211e1a` (Δr−b 7, linear R/B 1.472) → `#1e1e1e`, same linear
   *  luminance 0.0133. It covers most of the sphere the panels do not, so it is
   *  the single largest solid angle the diffuse irradiance integrates. */
  bg: '#1e1e1e',
  /** Big soft key panel (top-front) → broad clearcoat highlight. NEUTRALISED
   *  to near-grey white (#f8f7f6, Δr−b 2) — the be7aac7 fix darkened the env BG
   *  but left this panel whisper-warm (#fffaf0 Δ15), and rubber/softGel's WIDE
   *  sheen lobe (sheen 1.0) broadly MIRRORS this panel across a FLAT coplanar
   *  slab face → the milk-chocolate read (2026-06-13 slab battery: rubber lit
   *  Δ25, softGel Δ27, local warm buckets Δ29). Specular/sheen bypass albedo,
   *  so the panel HUE lands at full strength regardless of the ink-black base
   *  (RATIFIED COLOR POLICY / ink-black D2-E). Full value + intensity KEPT
   *  (clearcoat/sheen still have a bright source — no Day-11 flat-blob); only
   *  the warm CAST is removed, so a broad mirror reads grey, never tan.
   *  ROUND 3: the last 2 go. `#f8f7f6` → `#f7f7f7`, linear luminance 0.9313
   *  both. Nothing about the panel changes except that it is now exactly grey. */
  key: { color: '#f7f7f7', intensity: 3 },
  /** Cool rim panel (back-left) → separates the form's dark side.
   *  ROUND 3: `#bcd0e8` (Δr−b −44 — by a wide margin the most chromatic value
   *  in the rig, it was simply pointing the other way) → `#cecece`, same linear
   *  luminance 0.6163. *"never hue"* is not a rule about warm; a cool band on a
   *  warm form is chromatic banding, and it is the exact signature
   *  `assert-register-light` row 3 uses to tell the Free Stroke rig APART from
   *  this one. The separation the panel exists for is positional, not
   *  chromatic: it comes from where it hangs and how bright it is, and both are
   *  unchanged. */
  rim: { color: '#cecece', intensity: 1.6 },
  /** Low fill (front-low) → soft underside glow for sheen. FS's #ffd9b0 (Δ79)
   *  → be7aac7 whisper-warm #e8e0d4 (Δ20) → NEUTRALISED #dcdad7 (Δ5): the same
   *  sheen-lobe flat-face mirror that warmed the KEY warmed this FILL too (it
   *  sits front-low, square in the sheen lobe of a down-tilted slab). Warmth
   *  killed, value/intensity kept (the underside glow that lifts sheen forms
   *  survives — just neutral now). Ink-black holds at every orbit angle.
   *  ROUND 3: `#dcdad7` → `#dadada`, linear luminance 0.7026 both. */
  fill: { color: '#dadada', intensity: 1.1 },
  /** Tight bright streak → crisp specular accent on curvature. Already exactly
   *  neutral; round 3 had nothing to do here. */
  streak: { color: '#ffffff', intensity: 4 },
};

/** The 2026-08-02 palette, PARKED rather than deleted, so round 3 is a dial and
 *  not a memory. Reachable live: `window.__studioRigLaw = "prior"` before the
 *  page boots (dev only) puts the whole rig — env AND direct lights — back to
 *  exactly what Sebs was looking at when he said *"too brown"*. That arm is
 *  what `assert-register-light`'s neutrality rows use as their known-bad, so
 *  the bar is shown a build it must reject rather than only the one it was
 *  written for. */
export const STUDIO_ENV_PRIOR: StudioEnvPalette = {
  bg: '#211e1a',
  key: { color: '#f8f7f6', intensity: 3 },
  rim: { color: '#bcd0e8', intensity: 1.6 },
  fill: { color: '#dcdad7', intensity: 1.1 },
  streak: { color: '#ffffff', intensity: 4 },
};

// ── The DIRECT lights, in one named table ──────────────────────────────────
//
// ⚠ THESE ARE NOT PART OF THE ENVIRONMENT AND THEY WERE NOT DE-WARMED WITH IT.
// The two de-warming rounds recorded above (`#ffd9b0` Δr−b 79 → `#e8e0d4` Δ20 →
// `#dcdad7` Δ5, plus the key at Δ2 and the near-black bg) all landed on
// `STUDIO_ENV` — the four Lightformers inside the baked `<Environment>`. The
// scene lights below were written for a WHITE-PAPER world ("sky-warm above,
// paper-bounce below", see the comment at the rig) and were never revisited:
// hemisphere ground `#cdbfa6` Δ39, key directional `#fff3e0` Δ31, near point
// `#fff6e6` Δ25, hemisphere sky `#fff7e8` Δ23. Measured 2026-08-04, they are
// the widest chromatic channel anywhere in this rig.
//
// They are lifted into a table for the reason `STUDIO_ENV` is a table: so the
// values the product ships are the values a gate can read, and so an ablation
// can ATTRIBUTE the hue on the form to a source instead of arguing about it.
// Values are byte-identical to the inline props they replace; `dimFill` keeps
// the svg-port trim's alternate intensities beside the ones they replace.
//
// ROUND 3 replaces every colour below with its LUMINANCE-MATCHED grey — same
// Rec.709 linear luminance, zero hue — so each light delivers exactly the value
// it delivered before. Measured contribution of the whole swap, on the real
// page: brightest-decile Δr−b 23.92 → 21.57, interior median 46.3 → 46.2. Small,
// and it is the honest size: the ink was carrying the rest (see `STUDIO_ENV`'s
// round-3 block for the four-arm table).
export const STUDIO_DIRECT: StudioDirectLights = {
  /** Omnidirectional floor. Neutral, and always was. */
  ambient: { intensity: 0.25, dim: 0.07 },
  /** Paper-bounce stand-in. WAS sky `#fff7e8` (Δ23) / ground `#cdbfa6` (Δ39) —
   *  the ground bounce was the most chromatic light in the rig at linear R/B
   *  1.601, warmer than the ink it was lighting. Both luminance-matched:
   *  0.9361 and 0.5299. */
  hemi: { sky: '#f8f8f8', ground: '#c0c0c0', intensity: 0.55, dim: 0.16 },
  /** Key directional (top-front-right) — the brightest direct source, so its
   *  hue is the one that lands on the lit face. WAS `#fff3e0` (Δ31, linear R/B
   *  1.342); linear luminance 0.9074 either way. */
  key: { color: '#f4f4f4', intensity: 1.45 },
  /** Counter-fill (back-left). WAS `#e3eaf2` (Δ−15) — COOL, so neutralising it
   *  makes the form marginally warmer, not cooler. Done anyway: the register
   *  bans hue, not warmth, and leaving a blue fill in to cancel a brown ink is
   *  the over-cooling failure mirrored. Luminance 0.8159 either way. */
  cool: { color: '#e9e9e9', intensity: 0.5 },
  /** Under-bounce (below, behind). Untinted, and always was. */
  bounce: { color: '#ffffff', intensity: 0.3 },
  /** Near point light — the one that stops a flat extrude face reading as a
   *  blob, and therefore the one whose colour lands hardest on the front. WAS
   *  `#fff6e6` (Δ25, linear R/B 1.264); luminance 0.9288 either way. */
  point: { color: '#f7f7f7', intensity: 75, dim: 14 },
}

/** The pre-round-3 direct lights, parked beside the env prior for the same
 *  reason and reachable through the same switch. */
export const STUDIO_DIRECT_PRIOR: StudioDirectLights = {
  ambient: { intensity: 0.25, dim: 0.07 },
  hemi: { sky: '#fff7e8', ground: '#cdbfa6', intensity: 0.55, dim: 0.16 },
  key: { color: '#fff3e0', intensity: 1.45 },
  cool: { color: '#e3eaf2', intensity: 0.5 },
  bounce: { color: '#ffffff', intensity: 0.3 },
  point: { color: '#fff6e6', intensity: 75, dim: 14 },
}

/**
 * WHICH RIG RENDERS — shipped, or the parked 2026-08-02 warm one.
 *
 * Shaped exactly like `viewport-3d.tsx`'s `resolveHeroLitLaw`, and for the same
 * reason: the prior read has to be RENDERED rather than remembered, or the gate
 * that says "the neutral build is neutral" has never been shown a build it must
 * reject. Production always gets the shipped tables — a lane cannot leave a
 * probe value in a shipped build.
 *
 * `window.__studioRigLaw = "prior"` must be set before `<StudioRig>` first
 * renders; `<Environment frames={1}>` bakes once per mount, so a script that
 * flips it later has to force a remount (the register pills do that, and
 * `assert-register-light.mjs` already uses that path).
 */
export type StudioRigLaw = { env: StudioEnvPalette; direct: StudioDirectLights }
export function resolveStudioRigLaw(): StudioRigLaw {
  if (process.env.NODE_ENV === "production") return { env: STUDIO_ENV, direct: STUDIO_DIRECT }
  const w = globalThis as unknown as { __studioRigLaw?: unknown }
  if (w.__studioRigLaw === "prior") return { env: STUDIO_ENV_PRIOR, direct: STUDIO_DIRECT_PRIOR }
  return { env: STUDIO_ENV, direct: STUDIO_DIRECT }
}

/** The full studio rig (scene lights + baked Environment) — EXPORTED so the
 *  material battery renders through the EXACT product rig (the tier-2 board
 *  harness omitted the Environment bake, which is precisely the gap that let
 *  the env-reflection tan band ship unseen). */
export function StudioRig({ dimFill = false, lite = false }: { dimFill?: boolean; lite?: boolean } = {}) {
  // SVG-PORT FILL TRIM (sparse-legibility pass 2026-06-13, round-1's "cheapest
  // next lever = trim the studio rig's fill"): the full ambient/hemisphere/near-
  // point flood lights a near-white svg-port cap so evenly that SHALLOW carved
  // relief catches no shadow — the marks wash out. When svg-port is the active
  // style we drop the omnidirectional fills HARD so the form is shaped almost
  // entirely by the grazing svg-port key (added in the scene) — that rake is what
  // makes the grooves throw the highlight/shadow that reads as engraved. Native/
  // Hatch keep the full rig (dimFill stays false → byte-identical for them).
  // Resolved once per render so a `prior` arm swaps the WHOLE rig — direct
  // lights and env together — rather than half of it.
  const { env: ENV, direct: DIR } = resolveStudioRigLaw();
  const amb = dimFill ? DIR.ambient.dim : DIR.ambient.intensity;
  const hemi = dimFill ? DIR.hemi.dim : DIR.hemi.intensity;
  const pt = dimFill ? DIR.point.dim : DIR.point.intensity;
  return (
    <>
      {/* Studio rig — Free Stroke key+fill+rim structure (positions verbatim
          from viewport-3d.tsx), re-balanced for white paper: hemisphere light
          stands in for paper bounce (sky-warm above, paper-bounce below) and
          the ambient floor drops so form shading keeps its gradient range.
          The hatch/svg-port ShaderMaterial computes its own lambert from the
          same key/fill directions — the rig stays for Native + shadows. */}
      <ambientLight intensity={amb} />
      <hemisphereLight args={[DIR.hemi.sky, DIR.hemi.ground, hemi]} />
      <directionalLight position={[5, 8, 5]} intensity={DIR.key.intensity} color={DIR.key.color} />
      <directionalLight position={[-4, 2, -2]} intensity={DIR.cool.intensity} color={DIR.cool.color} />
      <directionalLight position={[0, -3, -5]} intensity={DIR.bounce.intensity} color={DIR.bounce.color} />
      {/* Soft near point light (white-paper adaptation): directionals shade a
          FLAT camera-facing extrude face perfectly uniformly (constant N·L) —
          a nearby point light varies with position, so flat faces get a real
          brightness gradient instead of the blob read. decay 2 physical.
          DROPPED for svg-port (dimFill): this broad near-fill is the main
          shallow-relief washer. */}
      <pointLight position={[4, 5, 6.5]} intensity={pt} decay={2} color={DIR.point.color} />
      {/* Offline studio environment (no HDR fetch) — ported from Free Stroke:
          clearcoat/sheen need something to reflect or the physical material
          collapses to flat diffuse. resolution 256, frames={1} bakes it ONCE
          (static, deterministic, no per-frame cost). Palette = STUDIO_ENV,
          resolved through `resolveStudioRigLaw()` so the parked warm prior
          renders as a real arm.
          SKIPPED in `lite` (transparent thumbnails): the desk flips MANY object
          canvases at once, and N simultaneous Environment CubeCamera bakes
          exhaust the GL context → "CubeCamera.update" crash (Sebs 2026-06-14).
          The direct key/fill/rim + point lights still shape the form. */}
      {!lite && (
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={[ENV.bg]} />
        <Lightformer
          form="rect"
          intensity={ENV.key.intensity}
          color={ENV.key.color}
          position={[2.5, 4, 3]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[8, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={ENV.rim.intensity}
          color={ENV.rim.color}
          position={[-4, 1.5, -3]}
          rotation={[0, Math.PI / 2.2, 0]}
          scale={[5, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={ENV.fill.intensity}
          color={ENV.fill.color}
          position={[1, -2.5, 2]}
          rotation={[Math.PI / 2.5, 0, 0]}
          scale={[6, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={ENV.streak.intensity}
          color={ENV.streak.color}
          position={[-1.5, 3, 2.5]}
          rotation={[-Math.PI / 4, 0, 0]}
          scale={[0.6, 5, 1]}
        />
      </Environment>
      )}
    </>
  );
}

/** FRESNEL RIM GLOW (R10, Sebs 2026-06-15 — "ink-black + rim glow"). An
 *  ink-black 3D form reads as a featureless silhouette/blob: its interior relief
 *  has no value contrast, and ink-on-ink edge lines are invisible. A view-angle
 *  fresnel term emits a soft warm-paper glow along the silhouette + every
 *  curvature edge (where the normal grazes the eye) — so the FORM pops as a
 *  backlit inked sculpture at ANY size or orbit angle (works at homepage
 *  thumbnail size where positional rim lights fail). Body stays pure ink-black;
 *  only the rim lifts. Injected at <dithering_fragment> where `normal` (view-
 *  space) + `vViewPosition` are both valid; adds to gl_FragColor after tonemap.
 *
 *  PORT NOTE (Free Stroke): CHAINED rather than assigned — see the file header,
 *  item 2. Everything below the chain lines is Desk Doodles' code unmodified. */
export function applyRimGlow(mat: THREE.MeshPhysicalMaterial): void {
  // ── port change: capture the existing hooks so the style-layer stack that
  //    already owns them survives. Desk Doodles has no prior hook to preserve.
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)
    // SUBTLE: a faint warm rim ONLY at the grazing silhouette so the form reads
    // but the body stays ink-BLACK (Sebs: "rim glow is fine as long as it's still
    // blackish — we only use black, like the svg strokes"). 1.9 washed it grey.
    //
    // ⚠ PORT DEVIATION 6 (2026-08-04) — the only VALUE in this file that is not
    // Desk Doodles'. `#fdf6ea` (Δr−b 19) → `#f7f7f7`, identical linear
    // luminance 0.9273, so the rim's brightness, its falloff and its
    // edge-selectivity are unchanged and only its hue is gone.
    //
    // IT IS DEVIATED BECAUSE IT WAS MEASURED, not because the round-3 sweep
    // reached it. `assert-register-light.mjs` reads the DD form at the drawing
    // lab's tight framing, edge pixels included: with the rim ON the form's p90
    // per-pixel CIELAB C* is 1.40, with the rim OFF it is 0.00 — once the ink
    // and the rig went neutral this constant was carrying ONE HUNDRED PER CENT
    // of the register's remaining chroma, on the silhouette, which is the part
    // of a dark form the eye reads colour from. Sebs's law (lib/registers.ts:
    // *"never hue"*) outranks the port convention, and the convention's own
    // rule is that every deviation is written down exhaustively — this is
    // number 6, and the file header lists the other five.
    //
    // On the HERO mark it changes nothing visible and that is stated rather
    // than assumed: at `uRimPower` 2.6 a scanline across one settled-solid
    // stroke runs `45.1 · 49.3 · 57.2 · 119.1 · 226.3 · 250`, monotonic into
    // paper with no local maximum, i.e. no halo at all. The deviation is for
    // the LAB framing, where the rim is real.
    shader.uniforms.uRimColor = { value: new THREE.Color('#f7f7f7') };
    shader.uniforms.uRimPower = { value: 2.6 };
    shader.uniforms.uRimStrength = { value: 0.55 };
    shader.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n' +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `float dd_rim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), uRimPower);
         gl_FragColor.rgb += uRimColor * (dd_rim * uRimStrength);
         #include <dithering_fragment>`,
      );
  };
  // onBeforeCompile materials need a custom cache key or three reuses the wrong
  // program. Key on the rim version + map presence: the svg-port path CLONES
  // this material and adds normal/emissive/bump maps — those clones must compile
  // their OWN (map-aware) program, not reuse the map-less one.
  mat.customProgramCacheKey = () =>
    // ── port change: prefix the style-layer key so the two systems can't
    //    collide on one cached program.
    (prevKey ? prevKey.call(mat) + '|' : '') +
    'dd-rim-v1|' +
    (mat.normalMap ? 'n' : '') +
    (mat.emissiveMap ? 'e' : '') +
    (mat.bumpMap ? 'b' : '') +
    (mat.map ? 'm' : '');
}

/** Ground-contact shadow (soft AO pool under the doodle — the cue that the
 *  form is an OBJECT above paper, not a flat mark on it). */
export const CONTACT_SHADOW = {
  opacity: 0.32,
  blur: 2.6,
  color: '#3a3128',
  resolution: 256,
  scale: 14, // pool is ≤ 8 world units wide — covers with margin
  far: 6, // capture height above the plane
} as const;
/** Gap between the lowest geometry point and the shadow plane. */
export const CONTACT_SHADOW_DROP = 0.04;

/**
 * Desk Doodles' `<ContactShadows>` usage, wrapped so the call site here reads
 * the same as the call site there. Props verbatim from Stroke3DScene.tsx.
 *
 * Desk Doodles gates this off on a TRANSPARENT background (`hideContactShadow
 * = transparent`) — a shadow patch on a page that is showing through reads as
 * dirt, not as contact. Free Stroke's transparent path is `captureMode`, so
 * the caller passes the same gate.
 *
 * PORT CHANGE — `near`. drei blurs the baked pool by rendering a helper plane
 * that sits at the WORLD ORIGIN through the shadow camera, which looks straight
 * up from wherever the shadow group was placed. Desk Doodles' forms sit around
 * the origin, so that helper is always in front of the camera and the blur
 * lands. Free Stroke's hero word is framed with its feet ABOVE y=0 (measured:
 * minY = +0.49 for the traced logo), which puts the helper plane BEHIND the
 * camera — it gets clipped, the blur passes write an empty target, and the
 * pool disappears entirely. Measured with `near` at drei's default 0: the
 * ground under the form stayed at background luminance in every pose. Pulling
 * the near plane back past the origin re-admits the helper. It costs a small
 * shift in the height falloff (the depth range grows from `far` to
 * `far + |near|`, ~8% here) and nothing else, and it is a no-op — byte-identical
 * to Desk Doodles — whenever the form already reaches y=0.
 *
 * PORT CHANGE — `frames`. Desk Doodles bakes the pool ONCE per mount
 * (`frames={1}`), which is deterministic there because its forms are simply
 * present: nothing animates their visibility. Free Stroke's forms are revealed
 * by a draw-in that toggles `mesh.visible` inside a per-frame loop, and drei
 * bakes the pool from the PREVIOUS frame's scene — so a single bake captures
 * the scene as it was before anything was revealed, i.e. an empty pool, and
 * never corrects itself. Measured: with `frames={1}` the ground under the form
 * stayed at background luminance in every captured pose. Baking continuously
 * is drei's own default and costs one 256² depth render plus four blur passes
 * per frame. The rebuild key is kept as well, so a geometry change still
 * forces a clean remount.
 */
export function StudioContactShadow({
  centerX,
  centerZ,
  minY,
  radius,
  rebuildKey,
  opacityScale = 1,
}: {
  centerX: number
  centerZ: number
  /** Lowest point of the geometry in world Y. */
  minY: number
  radius: number
  /** Changes whenever the geometry does, so the pool remounts clean. */
  rebuildKey: string
  /**
   * PORT CHANGE — `opacityScale`. Desk Doodles' pool is either there or not,
   * because its forms are always solid. The hero beat has a state where the
   * form is a flat mark ON the paper rather than an object above it, and this
   * pool is precisely the cue that distinguishes those two — a drawing does
   * not cast a contact shadow. So the pool has to be able to arrive WITH the
   * volume instead of being present before there is anything to cast it.
   * Defaults to 1, which is byte-identical to Desk Doodles' own usage.
   */
  opacityScale?: number
}) {
  const planeY = minY - CONTACT_SHADOW_DROP
  return (
    <ContactShadows
      key={rebuildKey}
      position={[centerX, planeY, centerZ]}
      near={planeY > 0 ? -(planeY + 0.25) : 0}
      opacity={CONTACT_SHADOW.opacity * opacityScale}
      blur={CONTACT_SHADOW.blur}
      color={CONTACT_SHADOW.color}
      resolution={CONTACT_SHADOW.resolution}
      scale={Math.max(CONTACT_SHADOW.scale, radius * 3)}
      far={CONTACT_SHADOW.far}
    />
  )
}

/* ========================================================================== */
/*  FREE STROKE — this app's own rig, lifted verbatim from viewport-3d.tsx     */
/* ========================================================================== */

export function FreeStrokeRig() {
  return (
    <>
      {/* Lighting: key + fill + rim for gel-ink specular highlights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -2]} intensity={0.4} />
      <directionalLight position={[0, -3, -5]} intensity={0.3} />

      {/* Offline studio environment (no HDR fetch). This is what makes the
          material presets actually read: clearcoat / metalness / sheen /
          reflectivity need something to reflect. Without an env map every
          preset collapses to "dark + slightly different roughness", which is
          exactly why all four modes looked identical. resolution kept small;
          frames=1 bakes it once (static, no per-frame cost). */}
      {/* Rig strengthened after live judging: at the old intensities the
          glossy presets were indistinguishable from ink at real stroke sizes —
          almost nothing bright existed to reflect. Matte presets are shielded
          by their own low envMapIntensity, so the hot rig does not wash them
          out; it is exactly the glossy/metal family that picks it up. */}
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={["#1a1d22"]} />
        {/* Big soft key panel (top-front) → broad clearcoat/gloss highlight */}
        <Lightformer
          form="rect"
          intensity={5}
          color="#ffffff"
          position={[2.5, 4, 3]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[8, 6, 1]}
        />
        {/* Cool rim panel (back-left) → separates dark surfaces from dark bg */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#9fc4ff"
          position={[-4, 1.5, -3]}
          rotation={[0, Math.PI / 2.2, 0]}
          scale={[5, 4, 1]}
        />
        {/* Warm low fill (front-low) → gives sheen/rubber a soft underside glow */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#ffd9b0"
          position={[1, -2.5, 2]}
          rotation={[Math.PI / 2.5, 0, 0]}
          scale={[6, 3, 1]}
        />
        {/* Tight bright streak → crisp specular line for gloss/chrome. The
            thing a "wet" surface visibly mirrors. */}
        <Lightformer
          form="rect"
          intensity={8}
          color="#ffffff"
          position={[-1.5, 3, 2.5]}
          rotation={[-Math.PI / 4, 0, 0]}
          scale={[0.4, 6, 1]}
        />
        {/* Long horizon band (eye level, behind) → gives chrome/gold/glossy a
            classic studio horizon to reflect, which is what makes metal read
            as metal instead of gray. */}
        <Lightformer
          form="rect"
          intensity={4.5}
          color="#f2ede4"
          position={[0, 0.4, -6]}
          scale={[14, 0.8, 1]}
        />
        {/* Three vertical "window" slats (front-right, camera side) → the
            structure a mirror needs. A mirror only reads as a mirror when the
            reflection has EDGES — distinct bright shapes separated by dark
            gaps that stretch and slide over the curvature. Before these,
            chrome had one soft key + one streak to reflect and read as dark
            gray metal. Slats face the origin from the DEFAULT CAMERA side, so
            the mirror read is head-on, not orbit-only. Matte presets are
            shielded by their own envMapIntensity (chalk 0.05, clay 0.12) —
            verified live that they do not wash out. */}
        <Lightformer
          form="rect"
          intensity={6}
          color="#ffffff"
          position={[2.2, 1.6, 4.5]}
          rotation={[0, -0.44, 0]}
          scale={[0.5, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={6}
          color="#eef2f8"
          position={[3.4, 1.6, 3.6]}
          rotation={[0, -0.65, 0]}
          scale={[0.5, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={6}
          color="#ffffff"
          position={[4.4, 1.6, 2.4]}
          rotation={[0, -0.9, 0]}
          scale={[0.5, 5, 1]}
        />
        {/* Soft wall BEHIND the camera (+z, big, dim) → flat faces that look
            straight at the viewer reflect straight back past the viewer, and
            before this panel that direction was pure void: chrome/iridescent
            front faces rendered as black holes head-on. A broad dim panel
            gives them a gentle graded reflection (and gives the thin-film
            preset a head-on signal to tint) while the slats keep supplying
            the hard structure. Intensity kept low so glossy blacks stay
            black-family. */}
        <Lightformer
          form="rect"
          intensity={0.55}
          color="#eef1f6"
          position={[0, 1.2, 7]}
          scale={[9, 6, 1]}
        />
        {/* Dim floor bounce (below) → separates a metal's dark underside from
            plain black: the lower half of a chrome tube reflects a faint warm
            floor instead of nothing, which sells "object in a room". */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#b9a98f"
          position={[0, -4, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>
    </>
  )
}

/* ========================================================================== */
/*  Selection                                                                 */
/* ========================================================================== */

/** Which of the two ported rigs a register lights with. */
export type RigId = "desk-doodles-studio" | "free-stroke-studio"

/** Renders the rig a register asks for. Nothing is interpolated or blended
 *  between them — each is the real thing, whole. */
export function RegisterRig({ rig }: { rig: RigId }) {
  return rig === "desk-doodles-studio" ? <StudioRig /> : <FreeStrokeRig />
}
