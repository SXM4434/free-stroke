# CARVE-AA lane log, 2026-09-30

STOPPED WITHOUT A PRODUCT CHANGE. The task as posed has no fix: at f224 the `s` is not carved, so no change to the carve band at 30 to 40 degrees can move that frame. Measured, not argued. The one lever that does move f224 is the head-on carve edge of the flat letters, and changing that changes how every flat letter looks at angles that already pass, which the brief rules out. That is his call, so the options are below and nothing is shipped.

Branch: `cloud/carve-aa`, as the brief names it (a snapshot at 52982e876). The only commit is this log.

## The cause

Read the letter model at the six graded frames (`sampleLetters` on `letterByLetter`, letter 2 = the `s`):

    f219  yaw 14.6  flat 1
    f220  yaw 34.6  flat 1
    f221  yaw 67.6  flat 1
    f222  yaw 90.0  flat 0
    f223  yaw 67.6  flat 0
    f224  yaw 34.6  flat 0
    letters 3 to 10: yaw 0.0, flat 1, the same on every frame f218 to f226

The `s` goes solid at the flip apex, f222. `fsPenCarveAmount()` is `uFsPenCarve * vFsLetterFlat * vFsLetterFace * smoothstep(...)`, so from f222 on, the `s`'s carve amount is 0: the `fsPenAmt > 0.0` block is skipped and neither divisor is evaluated on it. The divisor gate grades f224 as a grazing carve frame, but the only carved letters in that frame are letters 3 to 10, all head-on, all in the same pose as at f222 and f223.

What the f224 number actually measures: the speckle statistic closes the ink mask by 3 px and counts paper pixels inside. At f224 the solid `s`'s lower arm sits against the carved, head-on `k`. The two divisors give the `k`'s carved edge slightly different antialiasing, and that opens or closes a few pixels in the `s`/`k` gap. On this GPU the extra holes are about 15 pixels in that gap (hole map diffed between arms), not a stipple anywhere on the `s`. Head-on, `fwidth(sd)` is the L1 sum `|dFdx sd| + |dFdy sd|`, up to 1.41 times the true one-pixel gradient on a diagonal edge, so its ramp is a little wider than the prior's there. Main's older motion put the `s` at 53.1 degrees in a different place at f224, so the gap it formed with the `k` was different.

So CARVE's trace in the "LETTERS, merged" row (the ruled landing takes the `s` through 34.6 degrees, where the carve band's AA is weaker) holds for the angle, but not for the carve: at f224 the `s` has no carve band. The one graded frame where the `s` IS carved at 34.6 degrees is f220, and it passes, on the Mac (only f224 is red there) and here (-0.89 %).

## Evidence (this container, SwiftShader)

A temporary shader hook (reverted, never committed) let a probe try other ramp widths against the shipped `fwidth(sd)`, same session, same frames. "px vs shipped" = pixels differing by more than one 8-bit step from the shipped arm.

| candidate | f220 (s carved, 34.6 deg) | f224 (s solid, 34.6 deg) | f222 to f224, head-on letters |
|---|---|---|---|
| L2 gradient `length(vec2(dFdx sd, dFdy sd))`, only where the letter faces 18 to 45 degrees | 95 px vs shipped | **0 px vs shipped** | 0 px |
| L2 gradient everywhere | 1956 px | 1861 px | 1861 px, every frame |
| `min(fwidth(sd), prior)` everywhere | 1786 px | 1744 px | 1744 px, every frame |

The first row is the fix the brief asks for, and it does exactly nothing to f224. The other two move f224 only by changing the head-on carve edge of every flat letter on every frame.

Speckle counts, holes, prior -> shipped -> candidates (this GPU):

    t      prior  fwidth  L2-all  min(fw,prior)  L2-band-only
    7.300   788    781     770     777            781
    7.333   834    841     832     838            839
    7.367   706    703     696     700            703
    7.400   752    749     742     746            749
    7.433   731    728     721     725            728
    7.467   764    770     763     767            770

`L2-all` is the only arm here better than the prior on all six frames. But it changes every flat letter head-on, so it is a look change, not a fix inside the rules.

## Options for him (not done)

1. **Ship the true one-pixel ramp**, `length(vec2(dFdx(fsSd), dFdy(fsSd)))` in place of `fwidth(fsSd)`. It is the principled version of the `fwidth` fix: `sd / |grad sd|` is the exact pixel distance to the edge, and `fwidth`'s L1 sum over-widens diagonal edges by up to 1.41x. It would clear f224 (here -0.13 % vs prior) and every other graded frame. Cost: every flat letter's carved edge is up to 1.41x crisper on diagonals, at every angle, head-on included, about 1.8k px per frame at dsf 2. That needs his eye on the head-on letters, then a re-run of `assert-letters`, `assert-hero-options` and `assert-pentip-specks`, and the `PEN_TIP_AA_FWIDTH` sibling would want the same decision.
2. **Correct the gate's sampling, not the shader.** The gate calls f223 and f224 grazing carve frames while the `s` is solid on them. Sampling only frames where letter 2 is flat AND turning would stop it grading a frame the divisor cannot touch on the `s`. This changes a gate's frame set, so I did not do it: it reads as moving the goalposts unless he rules that the sampled frames are wrong, and the brief says f224 must pass.
3. **Leave it red and name it.** The red is a head-on `k` edge next to a solid `s`, 6 to 17 counts, not a stipple.

## Checks

- tsc: 6 errors, baseline 6 (on the snapshot; the tree is unchanged, so it stands).
- `assert-carve-graze`, snapshot, FS_HEADED=0, own server :3139, SwiftShader: 11 of 12 PASS. Frame-derivation row PASS (apex f222, samples f219 to f224, band frames f221 and f223). OVER THE BAND PASS here (4575 -> 4572, -0.07 %; it is red on the Mac). Per-frame 1.4 % row PASS here, f224 at +0.79 % (764 -> 770; the Mac reads 784 -> 801, +2.17 %). KNOWN-BAD A FAIL (0 of 6 reversed frames over 1.4 %; also red on the Mac). KNOWN-BAD B PASS, carve-off PASS (0 px), no page errors PASS. The probe's hole counts matched the gate's to the pixel on a second session.
- The f224 row cannot be made to fail on this GPU (it passes on the snapshot), so "f224 passes" could not be shown here in either direction. The model-side cause (the `s` is solid at f224) does not depend on the GPU.
- `assert-letters`, `assert-hero-options`: not run. No product file changed, so they are the snapshot's own run by construction.

## What I could not run, and setup notes

- No Mac and no real Chrome. The repo's launcher pins `channel: "chrome"`, so I symlinked `/opt/google/chrome/chrome` to the preinstalled Playwright Chromium 1194 (container only, no repo change). WebGL there is ANGLE on SwiftShader (Vulkan); `--use-angle=metal` is ignored on Linux. Speckle levels differ from the Mac, so every comparison above is arm against arm in one session.
- `pnpm install --frozen-lockfile` FAILS on the snapshot: `package.json` lists `dialkit@^1.4.3` and `motion@^12.43.0`, which `pnpm-lock.yaml` does not have (`app/desk-doodles/page.tsx` imports them). I installed with `--no-frozen-lockfile` and restored the lockfile; it is not committed. Someone should commit the matching lockfile on main.
- The gate wrote `docs/verification/carve-graze/assert/carve-graze.json`; left uncommitted. Dev server killed by exact pid after a cwd check, `.next/` deleted.
