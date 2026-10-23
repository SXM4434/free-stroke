# Research — Procedural texture phase

Sources consulted while building `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`,
what each one is, what it does, and what we actually used it for.

---

## 1. "Extending three.js materials with GLSL" — Dusan Bosnjak (pailhead)

**Link:** https://medium.com/@pailhead011/extending-three-js-materials-with-glsl-78ea7bbb9270

**What it is.** A write-up by a long-time three.js contributor about the
`onBeforeCompile` hook.

**What it does.** Explains that three.js builds its built-in materials by
stitching together named GLSL snippets called *chunks* (they appear in the
shader source as `#include <map_fragment>` and similar). `onBeforeCompile` hands
you the assembled shader source as a plain string *before* it is compiled, so
you can find a chunk by name and replace it with that chunk plus your own code.
Custom uniforms are added by assigning onto `shader.uniforms` and declaring them
at the top of the shader string.

**What we used it for.** This is the entire delivery mechanism for our texture
system. We do not write a material from scratch — we keep three.js's full
physically-based lighting (which is what makes the ink read as a real surface)
and splice pattern math into two specific points in its fragment shader.

**The gotcha it flagged, and how we handled it.** three.js decides whether two
materials can share a compiled shader program by hashing the *text* of your
`onBeforeCompile` function. Identical text means shared program, which can cause
surprising reuse. We sidestep the ambiguity entirely by setting an explicit
`customProgramCacheKey` returning a constant string: every material carrying our
texture layer deliberately shares one program, which is what we want since the
pattern is selected by a uniform rather than by different code.

---

## 2. GLSL noise algorithms gist — Patricio Gonzalez Vivo

**Link:** https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83

**What it is.** A widely-used collection of small GLSL noise and hash functions.

**What it does.** Provides the standard cheap "random from a coordinate"
one-liner built on `fract(sin(dot(...)) * <large number>)`, plus value-noise and
gradient-noise implementations built on top of it.

**What we used it for.** Our `fsHash` and `fsValueNoise` functions follow this
well-established form. We chose the hash + value-noise route (rather than
Perlin/simplex) because it is a handful of arithmetic operations per pixel,
which matters when the pattern is evaluated for every pixel of every frame while
geometry animation may also be rebuilding meshes.

**Caveat noted in the source.** These `fract(sin(...))` hashes are not
statistically rigorous and can differ slightly between GPUs. That is acceptable
here — the output is a decorative surface pattern, not anything that must match
bit-for-bit across machines.

---

## 3. The Book of Shaders, chapter 11 ("Noise") — Patricio Gonzalez Vivo & Jen Lowe

**Link:** https://thebookofshaders.com/11/

**What it is.** The standard interactive tutorial for procedural noise in
fragment shaders.

**What it does.** Explains value noise from first principles: hash the corners of
an integer grid, then blend between them. Crucially it shows *why* the blend
must be eased with a smoothstep curve rather than a straight linear mix —
linear blending leaves visible seams along the grid lines because the slope
changes abruptly at each cell boundary.

**What we used it for.** The `vec2 u = f * f * (3.0 - 2.0 * f)` line in our
`fsValueNoise`. That expression is smoothstep, and it is the reason our noise,
contour, and bubble patterns look organic instead of showing a faint square
grid.

---

## 4. three.js `WebGLPrograms` / `customProgramCacheKey` (library source + docs)

**What it is.** The three.js internals that decide when a shader program can be
reused between materials.

**What we used it for.** Confirming that our constant cache key is the correct
way to declare "all these materials share one program", and confirming that
changing a *uniform value* never triggers recompilation. That last fact is what
lets the whole texture system meet the PRD's gate: switching pattern, scale,
intensity, or animation writes uniform values only, so nothing recompiles and no
geometry is rebuilt.

---

## No visuals saved from these sources

All four are text/code references — there were no diagrams or videos worth
archiving. The visual record for this phase is our own captured evidence in
`docs/verification/texture-v1/`, which is the more useful artifact anyway since
it shows the technique applied to our actual geometry.
