# Lane log: animation-tools research and design

2026-09-25. Stopped at the 150k context gate.

Done: read the ruling, TRANSCRIPTS.md, REPO-2.md §5-6, the plan's Phase 22-24 and Layer G, and the machinery (stroke-schedule, frame-plan, recorder, draw-in-timing-controls, take-timeline, the desk-doodles dialkit dock, hero-motion's channels, the viewport's playhead chain and tip uniforms). Wrote DESIGN.md.

Not reached: web research on Theatre.js, AE Trim Paths and graph editor, Rive, Cavalry, Jitter, Figma Smart Animate, Spline, and the GSAP skill. DESIGN.md §6 lists the five Theatre.js questions to answer before Phase 3. The recommendation in §2 does not depend on them for Phases 1 and 2.

Next step: a fresh lane runs the tool research into `tools.md` here, and the Phase 1a lane builds from DESIGN.md §5.

## 2026-09-25 · references lane
- Wrote `REFERENCES.md` and `refs/` (7 images, each opened). Theatre.js §6 checks run: core Apache-2.0 50 KB gz, studio AGPL-3.0-only 244 KB gz; core headless and clock-driven (proven in Node); Studio owns its state in localStorage. Verdict: no Theatre for Phase 3.
- GSAP's licence bars visual animation builders: do not use it under the product.
- Left: DaVinci Resolve ripple naming unconfirmed (forum 403). Next step if needed: one fetch of Resolve's manual on Trim Edit mode.
- 2026-09-25 ANIM-3A: `lib/keyframes.ts` and `assert-keyframes.mjs` built on `lane/keys` (16/16 rows, 18/18 must-fails). drawProgress remaps the take clock. Left: phase 3b, the strip, curve editor, doc field and viewport writes; see RUN-QUEUE F118 ANIM-3A note.
