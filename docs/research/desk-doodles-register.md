# The Desk Doodles register — provenance

Where every number in `lib/registers.ts` comes from, and the laws that govern
them. Written so the register can be checked, extended, or ported without
re-deriving it from the Desk Doodles source each time.

Source repo: `~/Desktop/Projects/desk-doodles` (the canonical clone — a second
copy exists at `~/desk-doodles` at the same commit but without dependencies
installed). Its dev server runs on **5183**, because 5182 is occupied by
Frankendoodle, a fork that still serves the Desk Doodles desk UI on some routes
and is very easy to screenshot by mistake.

---

## 1. The laws

These are stated in the Desk Doodles docs as contracts, not preferences.

**Monochrome, and value never comes from hue.** From its 3D north-star:

> It's ALL ONE PENCIL. The entire aesthetic is MONOCHROME — black + grayscale —
> and what reads as "color" is purely VALUE (light→dark) produced by pencil
> moves: pressure, shading, hatch density. […] 3D must carry the SAME
> pencil-sketch character: a matte black/grayscale SKETCH with the pencil marks
> + shading preserved ON the form — NOT a glossy lit black solid that kills the
> sketch feel.

And the sharper corollary:

> VALUE = MARK DENSITY, NOT A TINT. the grey must EMERGE from black marks at
> varying density (hatch spacing / pressure), like a real pencil — NEVER a flat
> grey surface tint (a grey FORM reads as a "color" = wrong).

**Token discipline (invariant I-9).** The system "consumes locked-system tokens
only (W1 / W1-D ink, locked type, locked spacing). **Never invents tokens.**"
This is why the register's palette is the W1 ramp verbatim and its type sizes
are an enumerated ladder rather than a computed scale.

**svg-port lives it, doesn't wear it.** Its 3D style must re-create the 2D
treatment's feeling *from the mesh's own form* — never stamp the 2D drawing onto
it. Violating this shipped once and was caught by a diagnostic showing a
pixel-diff of exactly 0 between three supposedly different styles: the renderer
was never using the mesh at all.

---

## 2. Colour — the W1 "Near-White Hold" ramp

From `src/styles/theme.css`. Every value sits on a warm neutral axis; the widest
channel spread in the whole ramp is about 9.

| Token | Value | Role |
|---|---|---|
| `--dir-bg` | `#FDFCF9` | paper / ground |
| `--dir-raised` | `#F9F7F3` | lifted panel |
| `--dir-recessed` | `#F3F0E8` | well |
| `--dir-muted` | `#EBE7DC` | quietest filled surface |
| `--dir-border` | `#E3DFD4` | hairlines |
| `--dir-text-primary` | `#121110` | **the ink** |
| `--dir-text-body` | `#383632` | running text |
| `--dir-text-body-soft` | `#797369` | de-emphasised |
| `--dir-text-secondary` | `#5F5B54` | labels |
| `--dir-detail` | `#878075` | faintest legible ink |
| `--dir-accent` | `#121110` | same as primary, deliberately |

The darks are unified on purpose: in W1 the graphite ink *is* the accent, and a
separate accent hue would reintroduce exactly the chromatic promotion W1 was
chosen to avoid.

There is a hard rule that ink may never resolve to paper: palette overrides
remap ink only, because ink === paper makes strokes vanish. Roughly 197 shapes
lost all their strokes once when that protection was missing.

Uploads are luminance-flattened at ingestion (`monochromeSvg.ts`) so the whole
app — desk, editor, 3D — only ever sees a monochrome doodle. Value is preserved
so shapes stay distinct; only hue is removed.

---

## 3. Type and spacing

Three faces, three roles: **Clash Display 500** (display), **Instrument Serif
400** (editorial headings), **Instrument Sans** (body, UI, tracked caps).

Size ladder, in px: **10 · 11 · 13 · 15 · 18 · 22 · 32 · 52**, plus sanctioned
exceptions at 12 (CTA) and 28 (proof numerals). Explicitly *not* in the system:
14, 16, 17, 19, 20, 21, 24, 27, 31, 36 — which is why `registers.ts` enumerates
the ladder instead of generating one.

Spacing: **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 80 · 96 · 128**.

Note for anyone porting: Clash Display is identified in Desk Doodles' own
research as the portfolio's display voice and a candidate to retire precisely
because it reads as a reskin tell. The register uses Instrument Serif for
display for that reason.

---

## 4. Motion character

Described in their research as **"weighted calm"**: the desk is paper and paper
doesn't bounce, but the objects are playful hand-drawn things and minting one is
rare enough to earn a moment.

| Moment | Treatment |
|---|---|
| drag, sliders, pan/zoom | zero added motion |
| panel collapse | 260ms ease-out |
| popovers | ~180ms, origin-aware |
| doodle lands on desk | **one** spring 0.92 → 1, slight overshoot, interruptible |
| card mint | shared-element transition, rare enough to allow ~500ms |
| gallery load | 40–60ms stagger |
| create / edit / sandbox | **morph, never crossfade-replace** |

Reduced-motion honoured everywhere. Pill geometry is a house constant — fully
rounded pills — and stays.

---

## 5. The 3D surface

From `src/app/components/canvas3d/materials3d.ts`.

```
INK_3D_DEFAULT = '#2A2622'
INK_3D_RANGE   = { darkest: '#121110', lightest: '#383632' }
```

> **Free Stroke no longer ships `#2A2622`, and §1's law is why.** Sebs,
> 2026-08-04: *"the 3d version is also too brown, should still feel black."*
> Diffuse shading is `albedo × irradiance`, a multiply, so a chromatic albedo
> makes chroma rise in lockstep with value. At a drawing's value `#2A2622` is
> invisible (interior luma 20.6, CIELAB C\* 3.1 — it reads black); once
> `HERO_LIT.envGain` went 1 → 3.6 to make the 2D→3D switch legible, the lit form
> reached median 46.3 with its brightest decile at 80 and the *same* pigment
> arrived at Δr−b 23.9 / C\* 9.4. Nothing turned warm — the exposure went up and
> dragged the hue into view, which is precisely *"value from light, never hue"*
> failing. `lib/style-system.ts` now ships **`#272727`**, luminance-matched
> (0.01994 → 0.02029), with `#2A2622` parked as `DESK_DOODLES_INK_PRIOR` and the
> most token-disciplined warm alternative — `#282623`, the linear midpoint of
> `INK_3D_RANGE` — parked beside it as `DESK_DOODLES_INK_FAMILY_AXIS`. The
> family-axis option halves the violation (brightest decile Δr−b 13.3) and at
> 1:1 still reads dark khaki; only the neutral reads as graphite. Worth knowing
> when porting: **`#2A2622` is not on its own range's chromatic axis** — its
> linear R/B is 1.447 against 1.167 for `#121110` and 1.240 for `#383632`, so
> the default is warmer than either end of the family it belongs to. Frames and
> the four-arm table: `docs/verification/brown-hunt/`.

**Every material preset is the same colour.** The ratified policy: presets
differ only in surface qualities — roughness, metalness, sheen, clearcoat —
never in hue or value. Even the sheen colour was neutralised to a true grey
`#626262` at matched luminance, because a warm sheen tint flooded the ink to
beige at full sheen.

`MODE_MATERIAL_DEFAULTS_3D` maps **every** geometry mode to `matteClay`, with
the reasoning recorded inline: 3D reads as a matte pencil sketch, value from
light and never gloss; the previous glossy defaults "fought the pencil look".

matteClay: roughness 1.0, metalness 0, clearcoat 0, clearcoatRoughness 1.0,
reflectivity 0.08, sheen 0, envMapIntensity 0.12.

That is parameter-for-parameter identical to Free Stroke's own `matteClay`
except for colour — Desk Doodles forked this exact preset and re-coloured it to
its ink, and its source says so (`FS matteClay #6f6457 → ratified single ink`).
See explainer 08 for why the register still needs its own preset entry rather
than a colour override.

Corroborating evidence from their own material sweeps: the entire gloss family
— photoreal PBR, glossy plastic, and the polish / reflection / sheen dials at
their high end — was judged universally fake across every test mesh. Hatch and
greyscale were the only surfaces that read authentic on all of them.

---

## 6. The other half: the rig

The surface is only half of the Desk Doodles 3D look. The other half is the rig.
This section originally recorded it as *not* carried, which turned out to be the
whole problem — the register wore the right ink under the wrong light. The rig
is now **ported** into `components/studio-rig.tsx` (Desk Doodles' own
`STUDIO_ENV` / `StudioRig` / `applyRimGlow` / `CONTACT_SHADOW`, copied rather
than re-derived) and selected by `register.lighting`. The inventory below is the
research note that preceded the port; every item except the camera is now live:

- **Lights**: ambient 0.25; hemisphere `#fff7e8` / `#cdbfa6` at 0.55; key
  directional at (5, 8, 5) intensity 1.45 `#fff3e0`; cool fill at (−4, 2, −2)
  intensity 0.5 `#e3eaf2`; bounce at (0, −3, −5) intensity 0.3; and a near point
  light at (4, 5, 6.5) intensity 75 with physical decay — that last one exists
  specifically because directional lights shade a flat camera-facing face
  perfectly uniformly, which is what makes an extruded form read as a blob.
- **Environment**: a baked 256px env with four rect lightformers over a dark
  `#211e1a` ground. The palette here is aggressively de-warmed because specular
  reflection bypasses albedo, so any hue in the environment lands on the ink at
  full strength regardless of the base colour. An earlier warm version produced
  a measurable tan flood on glossy slabs.
- **Fresnel rim**: every native material carries a soft warm-paper rim
  (`#fdf6ea`, power 2.6, strength 0.55) so an ink-black form reads as a backlit
  inked sculpture instead of a featureless silhouette — and it works at
  thumbnail size where positional rim lights fail.

> **Round 3, 2026-08-04 — the rig above is Desk Doodles', and Free Stroke's is
> now neutral.** Two things this inventory does not say, both measured on the
> real page and both now fixed in `components/studio-rig.tsx`. First, the
> de-warming it describes only ever reached the *environment*; the **scene
> lights were never touched** and were the widest chromatic channel in the rig —
> hemisphere ground `#cdbfa6` (Δr−b 39, linear R/B 1.601, warmer than the ink it
> was lighting), key directional `#fff3e0` (Δ31), near point `#fff6e6` (Δ25),
> hemisphere sky `#fff7e8` (Δ23). Second, *"never hue"* is not a rule about warm:
> the cool rim panel `#bcd0e8` at Δ−44 was the single most chromatic value
> anywhere in it. Every colour in both tables is now its **luminance-matched
> grey**, so each light delivers exactly the value it delivered before and none
> of its hue — the interior median moved 46.3 → 46.3. The whole rig together was
> worth only ~2.4 of 23.9 Δr−b (the ink was the rest), but a light that supplies
> hue is the banned channel whatever its share, and a luminance-matched swap
> costs nothing. The pre-round-3 palette is parked live as `STUDIO_ENV_PRIOR` /
> `STUDIO_DIRECT_PRIOR` (`window.__studioRigLaw = "prior"`) and is what
> `assert-register-light --mutate=warmrig` and `assert-hero-switch
> --mutate=warmrig` use as their known-bad. The fresnel rim's own `#fdf6ea`
> (Δ19) went with them: once the ink and the rig were neutral it was carrying
> **100%** of the register's remaining chroma (form p90 C\* 1.40 rim-on, 0.00
> rim-off), so it ships as `#f7f7f7` — the only value in that file that is not
> Desk Doodles', recorded as port deviation 6 in its header.
- **Contact shadow**: opacity 0.32, blur 2.6, colour `#3a3128`, sitting 0.04
  below the form's lowest point — the cue that the form is an object *above*
  paper rather than a mark *on* it.
- **Camera**: fov 40, positioned along a normalised (0.5, 0.55, 1) three-quarter
  direction, fitted with a 1.32 margin including a sphere fit so no orbit angle
  clips the frame. **Still not carried** — Free Stroke's camera is fov 50 and is
  driven by the hero-beat choreography and the orbit harness, which own framing
  end to end. Framing is not lighting, and re-pointing it from the register
  would fight the beat.

Swapping the material alone got the surface right and the light wrong. The rig
now switches with the register, so the tuner UI describes the light each
register is under instead of apologising for not having one.

---

## 7. The 2D register, for reference

Not yet implemented in `registers.ts` — Free Stroke has no 2D mark renderer —
but recorded here because it is what "matching the stroke look" would mean.

**The drawing primitive** is `perfect-freehand` at `size 4, thinning 0.5,
smoothing 0.7, streamline 0.78`, rendered as a *filled polygon* in
`#121110`. The high streamline is deliberate: at 0.5, hand and sensor jitter
passed straight through into a faceted ribbon (measured at 117 sharp turns on
noisy input, versus 14 after).

A trap worth knowing: mouse and SVG input write a **constant 0.5** into the
pressure channel rather than leaving it undefined, which defeats naive
`pressures ?? fallback` gates. The 3D inflate path had to detect a flat channel
(max − min ≤ 0.02) and fall back to curvature-synthesised pressure.

**Styled** marks are not drawn by rough.js at all — the outline comes from
hand-written cubic-Bézier builders, and rough.js is used only for region fills,
always at `roughness: 0`. Line character is
`base[shape] × min(wobble, max(0.5, bboxMin/60))`, damped by
`max(0.05, 1 − curveDamp × 0.45)`, bowed by `bowing × damp × segLen × 0.06`.

**Tone** is solved, not styled: source darkness → Murray-Davies inverse →
quantised to an 8-band L\* table → per-grammar coverage model → rough.js gap and
weight, clamped to gap ∈ [1.5, 12] and weight ≤ 0.7 × gap. Coverage is capped at
0.72 because beyond it dense cross-hatch collapses into a structure-losing solid
black blob, and the goal is legible dense hatching.
