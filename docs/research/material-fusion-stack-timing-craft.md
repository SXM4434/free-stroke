# Research — material / fusion / stack / timing craft pass

Sources consulted before touching the code, what each one is, and the specific
decision it changed. Anything below that only restates what our code already
does has been cut; what is left is the material that told us something we did
not know.

---

## 1. three.js renderer internals — the one that mattered

**What.** `three@0.175.0` source, read directly:
`src/renderers/WebGLRenderer.js`, `src/renderers/webgl/WebGLMaterials.js`,
`src/renderers/webgl/WebGLPrograms.js`,
`src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`.
Cross-checked against the three.js forum threads
[Global environment map intensity?](https://discourse.threejs.org/t/global-environment-map-intensity/49014)
and
[Issues with changing envMapIntensity for all objects](https://discourse.threejs.org/t/issues-with-changing-envmapintensity-for-all-objects-in-three-js/69309),
and the [Scene docs](https://threejs.org/docs/pages/Scene.html) for
`environmentIntensity`.

**What it says.** Two findings, both load-bearing.

### 1a. `envMapIntensity` is silently discarded when the IBL comes from `scene.environment`

`WebGLMaterials.refreshMaterialUniforms` only uploads the material's own value
inside a guard:

```js
if ( material.envMap ) {
  uniforms.envMapIntensity.value = material.envMapIntensity;
}
```

and then `WebGLRenderer.js` (~line 2505) *overwrites* it for exactly the case
where the environment is scene-level:

```js
if ( material.isMeshStandardMaterial && material.envMap === null
     && scene.environment !== null ) {
  m_uniforms.envMapIntensity.value = scene.environmentIntensity;
}
```

The forum thread states the same rule in user terms: *"Changing a
`material.envMapIntensity` will only work if you have set a fully loaded texture
to the `material.envMap` property first."* `scene.environmentIntensity` was
added in r163 and only attenuates maps assigned to `Scene.environment`.

**What we used it for.** This is our single biggest finding. drei's
`<Environment>` sets `scene.environment` and leaves `material.envMap` null, so
**every material preset rendered at `environmentIntensity` (1.0) regardless of
the number it asked for** — chalk's 0.05 and chrome's 2.8 were the same value on
the GPU. So were the `envMapIntensity` writes in all five animated-material
types and in four fusion presets. The fix is one line: point `material.envMap`
at the same texture (`components/viewport-3d.tsx`, material section of the frame
loop), which takes the override branch out of play. Measured before/after on a
`custom` dielectric, inked-pixel mean luminance across `envMapIntensity` 0 → 3:
`68.2 68.2 68.2 68.2` before, `9.4 41.6 65.1 99.9 124.8` after.

### 1b. Without a thickness *map*, three.js ignores `iridescenceThicknessRange[0]` entirely

`lights_physical_fragment.glsl.js`:

```glsl
#ifdef USE_IRIDESCENCE_THICKNESSMAP
  material.iridescenceThickness =
    (iridescenceThicknessMaximum - iridescenceThicknessMinimum)
    * texture2D( iridescenceThicknessMap, ... ).g + iridescenceThicknessMinimum;
#else
  material.iridescenceThickness = iridescenceThicknessMaximum;   // <- us
#endif
```

**What we used it for.** The `iridescent` preset carries a comment claiming the
range was "widened to 120–800 nm so the film sweeps several interference ORDERS
across one curved tube". We have no `iridescenceThicknessMap`, so the range is
not a range: the film is a **constant 800 nm**. Widening from `[100, 400]` to
`[120, 800]` changed exactly one thing — the constant went 400 → 800 nm. See §2
for why that is the wrong direction.

## 2. Thin-film interference — which thicknesses actually produce colour

**What.** [Belcour & Barla, *A Practical Extension to Microfacet Theory for the
Modeling of Varying Iridescence*](https://belcour.github.io/blog/research/publication/2017/05/01/brdf-thin-film.html)
(SIGGRAPH 2017) — the model three.js's `evalIridescence` implements — plus
[OpenStax University Physics III §3.5, Interference in Thin
Films](https://phys.libretexts.org/Bookshelves/University_Physics/University_Physics_(OpenStax)/University_Physics_III_-_Optics_and_Modern_Physics_(OpenStax)/03:_Interference/3.05:_Interference_in_Thin_Films)
and the [OSA note on colour in thin
films](https://osa.magnet.fsu.edu/teachersparents/articles/colorthinfilmsinterference.html).

**What it says.** Hue comes from first-order interference; higher orders pack the
fringes closer together in wavelength until the spectral pre-integration
averages them out. Belcour & Barla: *"As thickness increases, one sees
higher-frequency colour banding, and the effect eventually converges toward a
'thick film' look where the colours fade to gray."* OpenStax/OSA: *"If the films
are much thicker, the iridescence vanishes… the different colours that all
interfere constructively overlap and produce a white colour."* First-order
visible reflection needs an *optical* thickness roughly in the 75–250 nm band.

**What we used it for.** It explains the measurement. Our `iridescent` preset
rendered with chroma 1.6–3.5 (neutral gray is 0; `gold` is 127, `neon` 103) —
i.e. no rainbow at all — because a constant 800 nm film with IOR 1.8 sits deep in
the higher orders, exactly the regime the literature says washes to gray. It also
tells us what to do instead: bring the constant back into the first order so the
hue sweeps with view angle across a curved tube. We swept thickness empirically
rather than guessing (`docs/verification/material-craft/iridescence/`).

## 3. Gloss perception — how to measure "does it read as glossy" instead of arguing about it

**What.** Motoyoshi, Nishida, Sharan & Adelson, [*Image statistics and the
perception of surface qualities*](https://www.nature.com/articles/nature05724),
Nature 447:206–209 (2007); follow-up [Sharan et al., *Image statistics for
surface reflectance perception*](https://opg.optica.org/josaa/abstract.cfm?uri=josaa-25-4-846),
JOSA A 25(4):846 (2008).

**What it says.** The **skewness of the luminance histogram** (and of sub-band
filter outputs) correlates with perceived gloss, and *inversely* with perceived
albedo. Glossy = mostly dark with a small very bright tail → strong positive
skew. It is a low-level statistic the visual system appears to use directly.

**What we used it for.** Two things.

1. It became an assertion. `scripts/verify/assert-material-craft.mjs` now reports
   per-preset luminance skew alongside mean and specular headroom, so "reads as
   glossy" is a number with a citation instead of a vibe.
2. It diagnosed the worst preset collapse in the family. `ceramic` (albedo
   `#e2e6ea`, luminance 223) and `chalk` (`#e7e2d6`, 229) are the closest pair at
   every view and every mode — 6.2 mean absolute difference on orbit/solid, when
   the next closest pair is 10.8. Ceramic is supposed to be a *hard wet glaze*
   and carries `roughness 0.12 / clearcoat 1.0` to prove it. It cannot work: a
   body already at 223/255 has no room below the highlight, so the histogram is
   clipped and unskewable. **A glaze read requires a dark body, not a smooth
   one.** That is a design constraint we could have argued about forever and
   instead can now measure.

## 4. Which parameters are structurally inert, and when

**What.** [three.js `MeshPhysicalMaterial`
docs](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) — `reflectivity`,
`sheen`, `sheenColor`, `clearcoat`; plus `WebGLPrograms.js` `HAS_CLEARCOAT /
HAS_SHEEN / HAS_IRIDESCENCE` and the version-bumping setters in
`MeshPhysicalMaterial.js`.

**What it says.**

- `reflectivity` "models the reflectivity of non-metallic materials and **has no
  effect when metalness is 1.0**".
- `sheen`, `clearcoat` and `iridescence` are compile-time features: the shader
  chunk is only included when the value is `> 0` at program-build time. three.js
  handles the 0-crossing for us (`set clearcoat(v) { if (this._clearcoat > 0 !==
  v > 0) this.version++ }`), so animating a parameter up from a zero base *does*
  work — at the cost of one shader relink at the crossing. Worth knowing before
  blaming a dial; this hypothesis was tested and cleared.
- Sheen is `sheen` (strength) × `sheenColor`. A black `sheenColor` makes the
  whole lobe arithmetic, not light.

**What we used it for.** Three findings.
`chrome` and `gold` both carry `reflectivity: 1.0` at `metalness: 1.0` — dead
numbers, and `signalFlicker` modulating `reflectivity` on a metal is 40 % wasted
work on `signal` and 0 % useful on a full metal. And the Custom-material panel
ships `sheenColor: "#000000"` / `emissive: "#000000"` as defaults, which makes
its **Sheen** and **Emissive** sliders do literally nothing until the user
guesses that a *second, unlabelled* control has to move first — measured:
`sheen 0→1` on the shipped default moves mean luminance 62.2 → 62.2; with a white
sheen colour it moves 62.2 → 110.0.

## 5. Motion craft — why "it moves" is not "it reads"

**What.** The portfolio motion skills now vendored into `.claude/skills/`:
`review-animations` (Emil Kowalski / animations.dev rubric),
`timing-mastery`, `timing-principle-mastery`, `12-principles-of-animation`,
`to-spring-or-not-to-spring`, `physics-intuition`, `emil-design-eng`.

**What they say**, restricted to what actually bears on this subsystem:

- **The Timing Contrast Principle** (`timing-principle-mastery`): *"Timing gains
  meaning through contrast. A fast action feels fast because something before it
  was slow… Monotonous timing lacks emphasis."*
- **The Hold** (same): *"One of timing's most powerful tools is the absence of
  motion… Never underestimate the power of stillness."*
- **Follow-through / overlapping action** (`timing-mastery`, `physics-intuition`):
  *"Stagger your timing. Not everything arrives at once. Lead with the main
  action, let secondary elements catch up on their own schedules."* Secondary
  action should land *slightly after* the primary beat.
- **Anticipation**: force requires wind-up; a long anticipation followed by
  instant action creates snap.
- **Decision framework** (`to-spring-or-not-to-spring`): user-driven → spring;
  system-driven → easing; **time representation (progress) → linear**.

**What we used it for.** This is the framework that names the *craft* half of
"the options are just weak", as opposed to the *bug* half in §1. Six of the eight
fusion presets and three of the five animated-material types are a bare
continuous sine in the 0.9–3.0 rad/s band with no hold, no anticipation and no
lag between driver and driven. They are not too small — several were already
pushed to large amplitudes in earlier passes precisely because they read weak.
They are **rhythmically identical**, which is why turning one on and switching
between them feels like nothing changed. It also validates one existing choice:
`revealSynced` mapping reveal linearly to phase is a *progress representation*,
which the framework says should be linear — that one is right as built.

---

## Sources

- [MeshPhysicalMaterial – three.js docs](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)
- [MeshPhysicalMaterial.reflectivity – three.js docs](https://threejs.org/docs/#api/materials/MeshPhysicalMaterial.reflectivity)
- [Scene – three.js docs (`environmentIntensity`)](https://threejs.org/docs/pages/Scene.html)
- [Global environment map intensity? – three.js forum](https://discourse.threejs.org/t/global-environment-map-intensity/49014)
- [Issues with Changing envMapIntensity for All Objects – three.js forum](https://discourse.threejs.org/t/issues-with-changing-envmapintensity-for-all-objects-in-three-js/69309)
- [Belcour & Barla, A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence (SIGGRAPH 2017)](https://belcour.github.io/blog/research/publication/2017/05/01/brdf-thin-film.html)
- [Interference in Thin Films — OpenStax University Physics III §3.5](https://phys.libretexts.org/Bookshelves/University_Physics/University_Physics_(OpenStax)/University_Physics_III_-_Optics_and_Modern_Physics_(OpenStax)/03:_Interference/3.05:_Interference_in_Thin_Films)
- [Color, Thin Films, and Interference — Optical Society of America](https://osa.magnet.fsu.edu/teachersparents/articles/colorthinfilmsinterference.html)
- [Motoyoshi, Nishida, Sharan & Adelson — Image statistics and the perception of surface qualities, Nature 447 (2007)](https://www.nature.com/articles/nature05724)
- [Sharan, Li, Motoyoshi, Nishida & Adelson — Image statistics for surface reflectance perception, JOSA A 25(4) (2008)](https://opg.optica.org/josaa/abstract.cfm?uri=josaa-25-4-846)
- [Three.js – Materials manual](https://threejs.org/manual/en/materials.html)
