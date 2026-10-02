# WebGL attribute validation — why one short buffer erases a whole mesh

Research behind [explainer 24](../explainers/24-the-attribute-that-outlived-its-surface.md).

Sources saved to disk: [`_sources/webgl-attribute-validation/`](_sources/webgl-attribute-validation/).

The question this had to answer: **the mark was submitted with 335 820 valid
indices at full opacity and rendered nothing.** Is that a defined behaviour with
a name, or was I looking at a driver bug? It is defined, it has a name, and the
answer changes what a gate in this repo has to check.

---

## 1. The normative text, verbatim

WebGL Specification, Version 1.0, §6.6 *Enabled Vertex Attributes and Range
Checking* — [registry.khronos.org/webgl/specs/latest/1.0](https://registry.khronos.org/webgl/specs/latest/1.0/)
(saved: `registry.khronos.org_webgl_specs_latest_1.0.html`, 278 620 bytes, HTTP 200):

> It is possible for draw commands to request data outside the bounds of a
> `WebGLBuffer` by calling a drawing command that requires fetching data for an
> **active vertex attribute, when it is enabled as an array**, either directly
> (`drawArrays`), or **indirectly from an indexed draw (`drawElements`)**.
>
> If this occurs, then one of the following behaviors will result:
>
> - The WebGL implementation **may generate an `INVALID_OPERATION` error and
>   draw no geometry.**
> - Out-of-range vertex fetches may return any of the following values:
>   - Values from anywhere within the buffer object.
>   - Zero values, or `(0,0,0,x)` vectors for vector reads …
>
> This behavior replicates that defined in \[KHRROBUSTACCESS].

Three things in that paragraph matter to us.

**"indirectly from an indexed draw."** The check is not on the index buffer.
It is on what the indices *reach* in every attribute. Our audit
(`firstBadIndex`) compared indices against `position` and reported clean —
which was true, and was an answer to a question that does not decide anything on
its own.

**"draw no geometry."** Not "drop the vertex", not "drop the triangle" — the
whole draw call produces nothing. One index past the end of one attribute and
119 856 triangles do not render. This is the sentence that explains why the mark
vanished *entirely* rather than losing a sliver, and why every material,
visibility and fragment-discard reading was simultaneously true and irrelevant:
no fragment was ever generated to discard.

**"one of the following behaviors."** It is a CHOICE. A conforming
implementation may instead hand the shader garbage — values from anywhere in the
buffer, or zeros. So the same defect is a blank screen on Chrome/ANGLE/Metal and
could be *wrong-looking letters* somewhere else. **The visible failure was the
lucky branch.** Had this implementation taken the other one, the cascade would
have rotated vertices by junk letter indices and nobody would have filed a bug.

---

## 2. The escape hatch that explains why it stayed hidden

Same section, and this is the sentence that closes the case on why the whole
verification battery was green:

> If a vertex attribute is enabled as an array, a buffer is bound to that
> attribute, **but the attribute is not consumed by the current program**, then
> regardless of the size of the bound buffer, it will not cause any error to be
> generated during a call to `drawArrays` or `drawElements`.

`aFsLetter` is only *consumed* when the letter-motion pass is compiled into the
program. On every mode and register where that pass is not on the
`onBeforeCompile` chain, a short `aFsLetter` is free — bound, enabled, ignored,
no error. The defect is therefore invisible except in exactly the configuration
the cascade needs, which is one more reason it survived a battery that grades
mostly-default states.

There is an open Khronos issue arguing browsers over-validate here relative to
the OpenGL ES 2.0 spec —
[KhronosGroup/WebGL#2986](https://github.com/KhronosGroup/WebGL/issues/2986) —
but it concerns attributes *enabled with no buffer bound*, and it is unresolved.
It does not touch our case: ours is consumed, bound, and genuinely too small.

---

## 3. Where the message actually comes from

Chrome's console said, 181 times:

```
[.WebGL-0x104000f3400] GL_INVALID_OPERATION: glDrawElements:
Vertex buffer is not big enough for the draw call.
```

That string is **ANGLE's**, not Chrome's own — it is emitted from ANGLE's vertex
data manager when the buffer backing a consumed attribute cannot cover the
indices the draw reaches, following OpenGL ES 3.0.2 §2.9.4. It is well attested
across engines that hit the same shape from different directions —
[wgpu#3578](https://github.com/gfx-rs/wgpu/issues/3578),
[openlayers#15459](https://github.com/openlayers/openlayers/issues/15459),
[pixijs#11364](https://github.com/pixijs/pixijs/issues/11364),
[drei#1444](https://github.com/pmndrs/drei/issues/1444) (three.js `Line` with
`vertexColors` — a per-vertex attribute shorter than `position`, which is
literally our defect in a different library). A first-hand write-up of the
platform-specific half is
[sheeptester, *Vertex buffer is not big enough on Mac only*](https://sheeptester.github.io/longer-tweets/vertex-buffer-not-big-enough/)
(saved).

**And it is emitted at `warning` level.** Every capture script in this repo
listens with

```js
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
```

so the message naming the defect was on the console for the whole investigation
and no instrument here could hear it. `assert-drawin-attrs.mjs` now reads console
messages at **every** level and counts this one explicitly. That is the cheapest
finding in this whole pass and probably the most reusable: **a filter on
`type === "error"` is a filter on which defects you are able to find.**

---

## 4. What this means for three.js specifically

`BufferGeometry` has no invariant tying its attributes to each other. Nothing in
three.js checks that `geometry.attributes.foo.count === geometry.attributes.position.count`,
and nothing checks either against the index buffer's maximum. `setAttribute` is a
`Map.set`. So a geometry whose `position` is replaced keeps every other attribute
at whatever length it had, silently, and the first place the disagreement is
noticed is the driver — which responds by drawing nothing.

Two library-level consequences we now rely on:

- **`geometry.dispose()` does not clear attributes.** `adoptBuffers` calls it to
  free the GPU buffers of the attributes being replaced (`WebGLGeometries` deletes
  the buffers a geometry holds *at dispose time*), and the geometry object stays
  usable and keeps its JS-side attribute map. So dispose-then-setAttribute frees
  VRAM and preserves exactly the stale-attribute hazard.
- **`deleteAttribute` is the only way to actually remove one**, which is what
  `dropStaleImplicitAttrs` does. Dropping is also the correct verb rather than
  resizing: a fresh marching-cubes run reorders every vertex, so a stale
  attribute is wrong at every index even when the counts happen to agree.

---

## 5. The rule this leaves behind

> **An in-place refill owns everything on the object, including what somebody
> else put there.**

This repo now has three in-place refills — the implicit geometry, the pen field
and the tip field — each built for the same good reason (an object's *contents*
change while its *identity* does not, which is the only way to get a rebuild onto
the screen without a React round trip). Every one of them is a place where no
dependency list can help, because there is deliberately nothing for a dependency
list to observe.

And the smaller rule, which cost the most hours here:

> **Auditing indices against `position` is not auditing indices.**

---

## Sources

- [WebGL Specification 1.0 §6.6 — Enabled Vertex Attributes and Range Checking](https://registry.khronos.org/webgl/specs/latest/1.0/) — the normative "draw no geometry" text and the not-consumed exemption. **Saved.**
- [KhronosGroup/WebGL#2986 — Unused vertex attributes and enable/disableVertexAttribArray](https://github.com/KhronosGroup/WebGL/issues/2986) — open, concerns the no-buffer-bound case, does not apply here.
- [webgl2fundamentals — Attributes](https://webgl2fundamentals.org/webgl/lessons/webgl-attributes.html) — what "enabled array attribute" means at the API level. **Saved.**
- [sheeptester — Vertex buffer is not big enough on Mac only](https://sheeptester.github.io/longer-tweets/vertex-buffer-not-big-enough/) — first-hand account of the ANGLE message. **Saved.**
- [gfx-rs/wgpu#3578](https://github.com/gfx-rs/wgpu/issues/3578) · [openlayers#15459](https://github.com/openlayers/openlayers/issues/15459) · [pixijs#11364](https://github.com/pixijs/pixijs/issues/11364) · [pmndrs/drei#1444](https://github.com/pmndrs/drei/issues/1444) — the same message reached from four other engines; drei's is a per-vertex attribute shorter than `position`, i.e. our defect in another library.
