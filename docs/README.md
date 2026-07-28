# Free Stroke docs

- **[PRD.md](PRD.md)** — the full project plan / phase map / operating rules. Source of
  truth for what gets built and in what order. `SESSION-HANDOFF.md` (repo root) records
  what's actually done.
- **[explainers/](explainers/)** — one doc per system explaining the code, the tech, the
  math, and the reasoning. Written for Sebs: graphics/shader/math concepts get full
  explanations from first principles; design concepts stay brief.
- **[research/](research/)** — everything researched online while building: what each
  source is, what it does, what we used it for. Saved images/videos from sources live here
  too, each with the same what/does/used-for explanation.
- **[verification/](verification/)** — frame captures used to visually verify each build
  pass (the standing rule: every edit gets frames/video analyzed, high frame counts).

## The build loop (per phase)

1. Research (documented in `research/`)
2. Build (smallest honest slice, geometry untouched)
3. Verify with frames — capture high-frame-count evidence, actually look at it
4. Document (`explainers/` + checkpoint in `SESSION-HANDOFF.md`)
5. Commit + push to the open PR branch
