# Explainer 05 — The layer stack

What got built in `POST_MVP_LAYER_STACK_PHASE_1`: the thing that turns three
independent effects into a composition.

Files: `lib/style-stack.ts` (new), `scripts/verify/assert-stack.mjs` (new),
`lib/style-shader.ts`, `lib/dither-shader.ts`, `lib/ascii-shader.ts`,
`lib/style-system.ts`, `components/viewport-3d.tsx`,
`components/style-panel-scaffold.tsx`.

---

## 1. What the stack adds

Texture, dither and ASCII already worked. You could switch all three on. What
you couldn't do was *compose* them: decide which one leads, how strongly each
lands, how each combines with what's underneath, and in what order.

The stack adds four things:

- **Opacity per layer** — how strongly this layer's result replaces what's below.
- **Blend mode** — how it combines (normal, multiply, screen).
- **Order** — which post-lighting layer runs first.
- **Presets** — five ready-made compositions.

And one principle, straight from your PRD: **one dominant graphic layer, the
others supporting.** Three layers at full strength is the visual soup the PRD
warns about, and `docs/verification/stack-v1/4_all_three.png` is what that looks
like — legible, but muddy and directionless.

---

## 2. The honest constraint: texture can't be reordered

Layer order sounds like it should be free. It isn't, and the reason is worth
understanding because it's structural rather than a shortcut.

**Texture is not a layer over the object. It's part of the object.** It
modulates albedo and roughness *before and during* lighting — that's precisely
what makes it read as a property of the material rather than a sticker. Dither
and ASCII both operate on the *final shaded tone*, after lighting is done.

So the pipeline is:

```
  texture → [ lighting ] → dither ⇄ ascii
     ↑                        ↑
  always base            genuinely swappable
```

Putting texture "above" ASCII would mean re-running the entire lighting
calculation on top of the glyphs — rendering the material twice. Not worth it
for a reorder control.

So the UI shows texture as **"1 · Texture (base)"** with a note explaining it's
part of the surface, and offers order only for the two layers that can actually
swap. **A control that silently does nothing is worse than a missing one** — it
implies capability that isn't there.

### Why dither ⇄ ascii order genuinely matters

These produce visibly different results (measured Δ 56.16, one of the largest
differences in the whole stack):

- **Dither → ASCII.** Tone is quantized first, so characters are chosen from
  already-reduced tone. Fewer distinct characters, crisper, more *printed*.
- **ASCII → Dither.** Glyphs are drawn first and *then* thresholded, so the
  dither breaks up the character shapes themselves. Grittier, more
  *degraded-terminal*.

---

## 3. The refactor that made ordering possible

Originally dither and ASCII were inline blocks pasted into the shader tail, each
mutating `gl_FragColor` where it sat. **An inline block can only ever run in the
position it was pasted** — you cannot reorder text that's already been
substituted.

So both became pure functions:

```glsl
vec3 fsApplyDither(vec3 col) { ... return fsStackBlend(col, dithered, mode, amount); }
vec3 fsApplyAscii (vec3 col) { ... return fsStackBlend(col, glyphed,  mode, amount); }
```

and the composer picks the order at runtime from a uniform:

```glsl
vec3 c = gl_FragColor.rgb;
if (uFsStackOrder < 0.5) { c = fsApplyDither(c); c = fsApplyAscii(c); }
else                     { c = fsApplyAscii(c);  c = fsApplyDither(c); }
gl_FragColor.rgb = c;
```

Both orders are compiled into one shader and selected by a uniform, so switching
order costs nothing — no recompile, no material swap, and the geometry-rebuild
gate still passes.

This is a good example of a refactor that isn't cosmetic: `vec3 → vec3` is what
*makes the feature possible*. Composability had to exist in the shader's shape
before it could exist in the UI.

---

## 4. Blend modes

Three, deliberately:

- **Normal** — the layer replaces what's underneath.
- **Multiply** — `base × layer`. Can only ever darken, since both are ≤ 1.
- **Screen** — `1 − (1−base)(1−layer)`. The mirror image: can only ever lighten.

Multiply and screen are complements, which is why they're the two worth having
first: one for adding weight, one for lifting. Overlay and threshold are more
situational and can come later.

Every layer routes through one shared helper:

```glsl
vec3 fsStackBlend(vec3 base, vec3 layer, float mode, float amount) {
  vec3 mixed = /* per mode */;
  return mix(base, mixed, clamp(amount, 0.0, 1.0));
}
```

One helper means a new blend mode is added once and every layer gets it, and
every layer honours `amount` identically.

---

## 5. How opacity composes with existing controls

Each layer already had its own strength control (texture intensity, dither
amount). The stack **multiplies** rather than overrides:

```ts
textureAmount = layerStackEnabled ? textureIntensity * stackTextureOpacity : textureIntensity
```

Two consequences, both wanted. A layer's own control keeps meaning what it
meant, and the stack opacity is a second dial at the composition level. And
turning the stack *off* leaves every layer exactly as it was — the systems stay
independently usable, which the PRD requires.

There's a third multiplier too: the timing envelope from
[the shared clock](04-timing-system.md). A one-shot pulse scales the layer's
`amount` as it decays. So a layer's final strength is:

```
its own control  ×  stack opacity  ×  timing envelope
```

Three dials, three different meanings: *how strong is this effect*, *how much
does it contribute to the composition*, *where is it in its animation*.

---

## 6. The presets, and what "taste" means numerically

Look at Soft Signal Stack — the only preset using all three layers:

```
stackTextureOpacity: 0.30    ← supporting
stackDitherOpacity:  0.35    ← supporting
stackAsciiOpacity:   0.85    ← DOMINANT
stackDitherBlend:  multiply  ← adds weight without competing
stackOrder:        asciiFirst
```

That's the PRD's taste rule expressed as numbers. One layer near full, the
others at roughly a third. The others aren't decoration — remove them and it
changes — but they aren't fighting for attention either.

The five presets each pick a different dominant layer: texture (Clean Ink),
dither (Dithered Gel, Graphic Slab), ASCII (Terminal, Soft Signal). Verified
pairwise distinct, closest pair Δ 22.37.

**A pleasant confirmation:** the presets visibly carry their *material* colour —
Terminal Stack reads cyan from the Signal material, Graphic Slab reads warm from
Matte Clay. That's the hue-preservation choice made back in the dither and ASCII
phases paying off: because both divide by luminance and re-apply the tint rather
than outputting pure black and white, the material system still means something
underneath the graphic layers.

---

## 7. Verification

`assert-stack.mjs` exists because **a control that renders identically whatever
you set it to is worse than a missing control.** Every stack control must
produce a measurably different image:

| Assertion | Δ |
|---|---|
| texture changes the base | 31.43 |
| dither changes texture-only | 47.67 |
| ascii changes texture+dither | 31.23 |
| **order** dither-first vs ascii-first | **56.16** |
| blend normal vs multiply | 24.98 |
| blend normal vs screen | 25.28 |
| blend multiply vs screen | 50.26 |
| **opacity** full vs low | **58.58** |
| all five presets pairwise distinct | 22.37 (closest) |

Presets are applied through the *real* preset-selection function the UI calls,
not a parallel test path — so this verifies what a user actually gets.

All 20 existing gates and all 10 timing assertions still pass after the shader
refactor.

---

## 8. What this phase does not do

- **No stack-level animation yet** — animating the whole group as one container
  is the next phase. It will use the shared clock's `amount` envelope, which
  exists for exactly this.
- No per-layer solo/mute, no saved custom stacks, no additional blend modes.
- No reordering texture (see §2 — structural).
- Geometry, geometry animation, and export untouched.
