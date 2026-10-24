# Dispatch — the ghost doc, applied here

**Method source (BINDING, read it, do not work from this summary):**
`~/Desktop/Projects/portfolio/portfolio-system-lab/docs/system/FABLE-GHOST-BRIEF-ENGINE.md`
and its hardened companion `AGENT-DISPATCH-CONTRACT.md`.

That engine is written against the portfolio repo, so its *doc paths* do not
transfer. **Its method does, entirely.** This file maps each step onto what
exists here. Sebs, 2026-07-30: *"use the ghost doc for everything."*

> **A memory is a POINTER, never a substitute.** No dispatch may work from a
> summary of a workflow. Read the real doc every time. If a memory and a doc
> disagree, the doc wins — then fix the memory.

---

## §0 · The two phases, both gated

**Phase 1 — IDEA CREATION (the map).** Produce the plan through the full
pre-flight + research loop. **It goes to Sebs in prose and he gates it BEFORE
any build fires.** The failure this exists to stop: a map drafted from a skim
came back derivative and was rejected. *You research to CREATE, not only to
evaluate.*

**Phase 2 — BUILD.** Author the gated plan through the loop again, rendering
every option, three visual loops.

The hero-beat storyboard is a Phase 1 deliverable. It is a plan for Sebs to
react to, and no build fires off it until he has.

---

## §0.5 · Model rule

- **FABLE** — visual authoring and hand-feel ONLY: the actual *look* of a
  thing, paper/material feel, motion feel and timing polish, the hand. **Budget
  is ~94% RED — flag Sebs and get his OK before firing one.**
- **OPUS** — everything else, which is most work: research, reading, maps,
  audits, engine math, instruments, wiring, analysis, orchestration.
- **SONNET** — never.

Applied here: instrument calibration, self-intersection detection, spacing
measurement and frame analysis are all Opus. The one place Fable earns its cost
is authoring the hero beat's key shots — and only once the board is gated.

---

## §1 · Pre-flight, mapped to this repo

Before writing any brief:

1. **`docs/README.md`** — the explainer + research index; find what touches the task.
2. **The relevant explainers, in full.** They carry the reasoning, not just the what.
3. **`docs/research/`** — especially `handwriting-variability.md` and
   `stroke-width-models.md`, which are the quality bar for what research means here.
4. **The Desk Doodles corpus where the task touches it:**
   `~/Desktop/Projects/desk-doodles/docs/submission/VIDEO-DIRECTION.md`,
   `CRAFT-VISUAL-PASS.md`, `docs/refs/`, and its `09-LOCKED-MODEL.md` invariants.
5. **The real engine check.** Name the in-repo implementation the agent must
   use — `lib/geometry-engines.ts`, `lib/dd-engine/`, `lib/implicit-surface.ts`,
   `lib/hero-motion.ts`, `scripts/verify/*`. If none exists, order
   research-then-build-real. **Never approximate.**
6. **Recency triage.** Any doc self-labelled done/verified that a later finding
   supersedes gets QUARANTINED — named as stale in the brief, with what
   supersedes it. Sebs's latest word outranks every self-claim on disk.
7. **Port, don't recreate.** Where Desk Doodles or Rock-3D already solves it,
   copy the real files with constants and comments intact, provenance at the
   top. Sebs: *"recreating will never feel right, direct usage always will."*

---

## §2 · Every brief carries these (VERBATIM — do not paraphrase thin)

Each of these marks a real, repeated failure here.

1. **Cite the source per change.** Every edit names the rule or finding it
   satisfies. An uncited change is drift by default.
2. **A citation is not evidence — it is a claim that evidence exists.** Every
   mechanism claim names what you *saw*, in which frames.
3. **Never report a win on your own claim.** Verify against artefacts — frames
   on disk, numbers, tsc output — not against your summary of what you did.
4. **The visual loop is unskippable.** Show the side-by-side proof.
5. **tsc-green plus one render verifies NOTHING.** Every state on screen once.
   Do not sample and claim.
6. **Calibrate the instrument against a known-bad input and require it to
   fail.** Ten instruments in this repo have reported green while measuring
   nothing. A green row that cannot fail is the lie.
7. **Names must match behaviour.** A dial whose label does not describe what
   renders is a defect — wire it or remove it.
8. **Open picks stay open.** Sebs-only calls are kept as dials and surfaced in
   prose with a recommendation. Never silently defaulted.
9. **Weak goes to the weak bucket, never into the count.** Padding is the
   median, which is the exact AI smell this system exists to kill.
10. **If it can't be done right, STOP and flag.** A flagged blocker with
    evidence is a good return; a shipped shortcut is a failed one. Persist
    until it works or is **proven** impossible, with the reason and the
    measurement that demonstrates it.
11. **Finish the brief.** A "half-done / not done" list is not an accepted
    ending. A session limit cutting you off is different — then report
    precisely what is done versus half-done.

---

## §3 · Verification here

- **Real Chrome, real GPU.** `{ channel: "chrome", args: ["--use-angle=metal"] }`,
  and neither is a call site's choice any more: `scripts/verify/lib/browser.mjs`
  adds both, and `assert-one-browser` fails the build on any script under
  `scripts/verify` that names `headless` in any spelling. The flag is
  load-bearing. Without it Chrome falls back to SwiftShader, which silently
  pauses the rAF loop with no error, and a frozen animation and a still one are
  identical in a screenshot. Never Playwright's bundled Chromium.
- **Headless is fine, and it is settled.** Commit `3884dd78` says *"all
  verification runs HEADED with Metal, never headless"*, and `RUN-QUEUE` recorded
  `assert-fusion-combo-ui` dying at 30 s headless while passing 14/14 headed.
  Re-measured 2026-08-28, neither claim survives:
  - the renderer string is **identical in both modes on both surfaces**,
    `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max)`, and rAF over 2 s reads
    **241 headless against 241 and 242 headed**. The 2026-07-30 reading
    reproduces, at 120 Hz instead of 60;
  - `waitUntil: "networkidle"` **resolves headless**, in 1.1 s against an idle
    server and 11.1 s against a busy one. It never hung;
  - the 30-second death was the **port**. Bare, the gate aimed at `:3000` and
    exits 1 in one second on `ERR_CONNECTION_REFUSED`. Aimed at the live server
    it is **14 PASS in 18 s, headless**.

  So the launcher's default stands. A call site that says nothing gets headless,
  `FS_HEADED=1` overrules it, and `FS_HEADED=0` overrules every call site at once.
- 🔴 **One browser-gate result is not evidence. It has to repeat.** Measured
  2026-08-28, three gates run three times in each mode, 18 runs: **headless 5 of
  9 green, headed 5 of 9 green, and all six gate-by-mode cells disagreed with
  themselves.** The variable is the dev server, not the window. Left completely
  alone for three minutes, a page served by an instance that had been up 2 d 3 h
  took **30 main-frame navigations** and a webpack hot update, with no source
  file moving under it. Every red measured was that arriving mid-gate:
  `Execution context was destroyed`, a `window.__…` harness gone, a census
  reading a surface that had rebuilt. **Restart the dev server before a battery,
  and re-run a red before you write it down.**
- **Save video as well as frames** under `docs/verification/`, and watch it
  back. Motion defects — crawl, strobing, judder — do not exist in a still.
- **Verify through the real UI**, not only a harness. A whole panel once
  rendered zero controls while harness assertions passed.
- `scripts/verify/verify-gates.mjs` must be **ALL PASS** — a SKIP is not a pass.
- **Run the battery, not a sample.** This file used to name exactly one gate, and
  that is half of why **73 of the repo's 81 `assert-*` scripts were in no sweep
  at all** (measured 2026-08-03; there are 100 of them as of 2026-08-28) — a
  gate nobody runs cannot fail in practice, whatever the meta-gate says about it
  in principle. Two commands cover all of
  them, and neither counts a skip as a pass:
  ```bash
  node scripts/verify/run-battery.mjs          # every MODEL gate, no browser
  node scripts/verify/run-browser-battery.mjs  # every BROWSER gate, serial, needs `pnpm dev`
  node scripts/verify/assert-gate-integrity.mjs   # …and can each of them FAIL?
  ```
  The model battery prints the browser list it did not run, by name, above its
  own summary. Per-gate logs land in
  `docs/verification/gate-integrity/browser-logs/`.
- **After a battery, sweep.** `node scripts/verify/sweep-browsers.mjs` names
  every Chrome this repo left behind and kills nothing; `--kill` ends only the
  orphans. A session limit is a `kill -9`, so no handler inside the dying lane
  gets a turn and the registry record in the temp dir is the only thing that
  outlives it. That is how 93 Chromes survived one morning.
- **One knob, one name: `FS_PORT`**, resolved once in
  `scripts/verify/lib/dev-server.mjs`. Leave it unset and the port is **derived
  from the dev server whose working directory is this checkout**, so a gate run
  bare reaches the server you actually have rather than the one the default was
  written for. Measured 2026-08-28: bare, `assert-tsc-baseline` was 2 PASS · 2
  UNSWEPT · exit 3 and `assert-fusion-combo-ui` died in 1 s on
  `ERR_CONNECTION_REFUSED at http://localhost:3000/`; after discovery, bare, they
  are 4 PASS · 0 UNSWEPT · exit 0 and 14 PASS · exit 0. Nothing serving this tree
  still falls back to 3000 and the gate still reports UNSWEPT, because discovery
  may find a server and may never invent a pass. Two servers on one tree refuses
  to pick and tells you to name it, since picking for you is how a run gets
  attributed to the wrong tree. Every run prints `[dev-server] :<port> · <why>`
  on stderr, so no run is attributed in silence. `HERO_URL` / `LAB_URL` /
  `FS_URL` are gone and setting any of them throws with the replacement command.
- `geometry-baseline.mjs --save=<label>` before and after anything touching
  geometry. It takes `--save=`, not `--label=`, and it resolves its URL through
  `lib/dev-server.mjs` like everything else.
- Typecheck against the known baseline; report the count, not a vibe.

---

## §4 · Concurrency

Declare file ownership per dispatch — never remembered, never assumed. Two live
lanes may never hold the same file. Shared modules carry their whole blast
radius: a lane touching one owns every consumer. `git status` and `git stash
list` before any long edit; a concurrent stash/pop cycle has silently reverted
engine files to HEAD twice.

---

## §5 · Keeping this honest

When Sebs sets a new standing rule, it is folded in **the same session**. This
file is only useful while it carries his current law — stale scaffolding is
drift with better formatting.
