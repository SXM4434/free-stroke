DONE

# CX-PORT-PERSTROKE

Base: `95b1e3343` on `codex/port-perstroke`. The checkout's `LOG.md` stayed unchanged. No push.

## Commits

1. Cloud step 1, `27fd4554d`: already present as `95b1e3343`. Landing math and its Node gate.
2. Cloud step 2, `8eb5ab357`: ported as `9a3ff5d6b`. The viewport keeps the existing tip highlight block and applies the landing pose after it.
3. Cloud step 3, `1d7727970`: ported as `2757e06b8`. Completion Pulse, controls, Customize fields, and session storage.
4. Integration fix, `ba15e4be0`: Completion Pulse sets all draw-in extras to Off. The old preset comparison excludes only the Completion Pulse shell from snapshot equality, while still checking that preset's extras and Customize fields. The affected gate passed 25 of 25 rows and caught 38 of 38 mutants.
5. Cloud step 4, `eae682151`: this final commit saves its `LOG.md` byte for byte as `docs/cloud-handoffs/perstroke-LOG.md` and writes this handoff. The branch's `LOG.md` remains unchanged.

The touched-path audit matched cloud step 1 at 3 of 3 files, step 2 at 2 of 2, and step 3 at 6 of 6. Cloud step 4 changed only `LOG.md`, which maps to the new handoff path by the job's explicit exception.

`tsc --noEmit -p .` reported the same six errors at the base, after each feature port, and after the integration fix: five in `lib/geometry-engines.ts` and one missing `perfect-freehand` module in `lib/dd-engine/handFeel.ts`. No TypeScript error was added.

## Main Node gates

| Gate | Rows | Must-fails | Result |
|---|---:|---:|---|
| assert-landing-motion | 23/23 | 28/28 | pass after the integration fix |
| assert-keyframes | 16/16 | 21/21 | pass |
| assert-key-paths | 7/7 | 8/8 | pass |
| assert-width-keys | 12/12 | 9/9 | pass |
| assert-camera-moves | 11/11 | 20/20 | pass |
| assert-flip-pose | 8/8 | 10/10 | pass |
| assert-stroke-timing | 16/16 | 12/12 | pass |
| assert-drawin-extras-node | 25/25 | 38/38 | pass after the integration fix |
| assert-fusion-chaos | 9/9 | 17/17 | pass |
| assert-export-formats | 3/3 | 6/6 | pass with `FFMPEG_BIN=/opt/homebrew/bin/ffmpeg` |

The first export run could not start GIF and WebM decoding because the `ffmpeg-static` package has no binary in this checkout. The rerun used the installed ffmpeg through the package's documented `FFMPEG_BIN` input. GIF passed 8 of 8 rows, WebM passed 4 of 4, and GLB passed 11 of 11. The format gate caught all 6 mutants.

## Other Node gates named in the cloud log

| Gate | Rows or claims | Controls | Result |
|---|---:|---:|---|
| assert-drawin-monotone | 16/16 | none | pass |
| assert-fusion-combos | 34/34 | none | pass |
| assert-fusion-rail | 4/4 | none | pass |
| assert-hero-camera | 10/10 | 8/8 | pass |
| assert-hero-ledger | 5/5 | 4/4 | pass |
| assert-hero-rise | 6/6 | 3/3 | pass |
| assert-hero-twos | 6/6 | none | pass |
| assert-hero-windup | 7/7 | 4/4 | pass |
| assert-hero-hold | 8/8 | none | pass |
| assert-hero-options | 41/41 | 21/22 | red control |
| assert-hero-return | 13/13 | none | pass |
| assert-hero-turn | 8/8 | 8/8 | pass |
| assert-motion-paste | 7/7 | none | pass |
| assert-preset-registry | 61/61 | none | pass |
| assert-style-contracts | 39/44 | none | 5 red, including the optional flip and landing defaults |
| assert-timing-origin | 42/42 | none | pass |
| assert-drawin-2d-parity | 5/6 | 3/3 | red first-ink placement row |

`assert-hero-options` and `assert-style-contracts` were red in the cloud log as well. The 2D parity gate ran here instead of being killed as in the cloud snapshot; it found an early ink centroid at 49.3% of the word against its first-third bar. The port did not change the 2D renderer or the reveal function that gate reads. The red result is recorded, not treated as a pass.

## Checks not completed

- `assert-hero-carve` could not assess its rows because its required `docs/verification/hero-transition/carve` captures are missing. Producing them would require a browser.
- `assert-hero-word-legible` completed some Node preflight rows, then indirectly called `_probe-word-ladder.mjs`, which tried to launch Chrome. I missed that child call. The Codex guard killed Chrome, so the full gate has no row count or browser result. I did not retry it.
- No browser gate was completed. No server was started for this job. The new AGENTS.md instruction forbids launching Chrome inside Codex, and this job also requested no browser.

The Node gates test their stated math, data, source wiring, and export files. They do not show the landing motion on screen or prove the browser export path.
