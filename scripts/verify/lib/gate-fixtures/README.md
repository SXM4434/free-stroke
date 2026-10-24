# Known-answer fixtures for `assert-gate-integrity.mjs`

These are the meta-gate's negative controls. Each one is a *deliberately broken*
`assert-` script carrying exactly one of the diseases the meta-gate exists to
find, plus one that is deliberately correct.

They live here, outside `scripts/verify/`, so the real sweep (which globs
`scripts/verify/assert-*.mjs`) never picks them up as subjects.

`node scripts/verify/assert-gate-integrity.mjs --calibrate` runs the analyser
against all of them and exits non-zero unless every verdict comes out as the
filename says. **A meta-gate that has never been shown to fail is the exact
disease it is looking for.**

| fixture | must be judged | the disease |
|---|---|---|
| `good-live-gate.mjs` | PASS | emits rows on the default path, exit coupled, captures live |
| `good-stored-gate.mjs` | PASS | judges stored frames, but refuses a missing label |
| `bad-capture-only.mjs` | FAIL `no-verdict` | prints numbers, never a judgement — `assert-joint-beading`'s disease |
| `bad-flag-gated.mjs` | FAIL `no-verdict` | every judgement sits behind `--check` — `assert-layer-flicker`'s disease |
| `bad-always-zero.mjs` | FAIL `exit-uncoupled` | prints FAIL rows and always `process.exit(0)` |
| `bad-dead-judge.mjs` | FAIL `no-verdict` | the judging function exists and is never called |
| `bad-catch-only-exit.mjs` | FAIL `exit-uncoupled` | the only non-zero exit is the crash handler |

## The 2026-08-03 additions — channels D, E, F, G

A, B and C ask *is this a gate*. All 80 scripts passed them on 2026-08-02 and the
tree read green; four more instruments were found unable to fail in the next
twenty-four hours, every one of them by accident. So four more channels, and
four more fixtures — because a channel that has never rejected anything is the
disease it is looking for, one level up, and one that has never *accepted*
anything is just as useless. Each channel gets a **pair**.

| fixture | must be judged | the disease |
|---|---|---|
| `good-sees-its-constant.mjs` | D CAN-FAIL | reads `DEFAULT_HERO_MOTION.fps` and pins it — moving the engine's copy turns it red |
| `bad-blind-to-its-constant.mjs` | D CANNOT-FAIL | *names* `fps`, prints `fps`, and asserts `frames > 0` — true of every frame rate. `assert-pen-field`'s disease, one step subtler: a grep for the constant finds it and reports the gate as covered |
| `bad-partial-inventory.mjs` | E PARTIAL | 4 of 7 `HeroShape` — `assert-hero-option-panel`'s four-films-against-a-seven-film-panel, and the ratio (0.571) that pins channel E's 0.50 floor |
| `good-full-inventory.mjs` | E COMPLETE | names all seven, so E must stay silent |
| `bad-skip-as-pass.mjs` | G SKIP-AS-PASS | prints three `SKIP` lines, `ALL GATES PASS`, and exits 0 — `verify-gates.mjs`'s old disease |

Channel F is calibrated on `freshnessOf()` arithmetic rather than a fixture
directory: a capture four days behind its subject must be REFUSED and one ahead
of it accepted. A fixture would need mtimes on disk, which a checkout does not
preserve.

**Channel D runs the fixture as a subprocess under a mutated `_ts-load.mjs`.**
`good-sees-its-constant.mjs` and `bad-blind-to-its-constant.mjs` therefore have
to be real, runnable gates against the real `lib/hero-motion.ts`, not sketches —
which is also why they are the only two fixtures here that import anything.

## Channel I — the invocation the next person will type

| fixture | must be judged | the disease |
|---|---|---|
| `bad-wrong-defaults.mjs` | I RED-WHEN-BARE | fresh capture, complete inventory, correct assertion — and the default `--ref` selects an arm shot before the change, so the row compares the shipped shape against neither of the two it is a claim about. `assert-pentip-specks`'s defect: its author reported "9 rows, ALL PASS" because they had typed the arguments; run bare it said the mark had grown blank spots |

The same fixture is its own positive control: `--ref=prior` names the shape the
shipped one actually replaced and it exits 0. The bar is the exit code of the
argument-free run and nothing else — the sweep cannot tell a broken surface from
wrong defaults, and does not claim to. It reports the fact and demands a person.
