# 39 — One frame is not a channel

Explainer 24's ruled-out table exonerated twelve candidates and shipped. Lane D
re-ran it with a negative control and found two rows that **measured nothing**.
Lane M then fixed `setFlatten` so the dead one says so. This pass ran the thing
those three asked for — **both directions on every channel** — and the answer was
not the one anybody was set up to expect.

**The dead key was a single occurrence. The class underneath it is not.**

Twenty-eight files in `scripts/verify/` drive `__captureHarness.setFlatten`.
Twenty-five were read in full. **Not one of them passes a key that does not
exist** — outside the two files whose bad keys are deliberate negative controls.
So the obvious inference from explainer 24 — *if one arm typo'd a key, others
must too* — is **wrong**, and it is worth saying, because it is the inference a
reader will make and then spend a night chasing.

What the survey found instead is three failure modes that produce the same
sentence — *"this arm changed nothing, so this candidate is not it"* — from three
different causes, and only one of them is a typo.

---

## 1. The three ways an OFAT arm reports about nothing

| | the arm | what happened | how it reads |
|---|---|---|---|
| **DEAD KEY** | `setFlatten({flat: 0})` | `flat` is not on `FlatState`; nothing was set | 0 px |
| **INERT HERE** | `setFlatten({jointBreak: 0})` at DRAW 96 % | the key was set; the channel does nothing at this playhead | 0 px |
| **GATED** | `setFlatten({lit: 1})` at `ink 1` | the key was set; the channel is multiplied by zero | 0 px |

Three causes, one reading, and the row's verdict is the same in all three:
**not it**.

The dead key is now impossible — `isValidFlatState` refuses the object whole and
returns `false`, and `assert-hero-flatstate.mjs` and `assert-stroke-schedule.mjs`
each carry a control that requires the refusal. **The other two are still open,
and neither of them is a bug in the code under test.** They are properties of
*where the arm was taken*.

### `INERT HERE` — measured on one channel across four surfaces

`jointBreak`, driven to 0 and to 1, on `/desk-doodles`, four poses of the same
page (`docs/verification/laneq-ofat/*/ofat.json`):

| pose | `jointBreak 0` | `jointBreak 1` | the two arms differ by |
|---|---:|---:|---:|
| DRAW 80 % of the FONT word | 0 | 0 | **0 px** |
| DRAW 96 % of the FONT word | 0 | 0 | **0 px** |
| the settled BREATH frame, dead-on | 0 | **437** | **437 px** |
| the settled BREATH frame, el 35° | 0 | **365** | **365 px** |

Explainer 24 §8 calls this an *"INERT CHANNEL"*. It is not one. It is a live
channel, and `assert-hero-flatstate.mjs` has asserted so since 2026-08-03 —
*"jointBreak RENDERS — the junctions open a hairline of paper"* — on the third
row of that table. **Two instruments in one repo held opposite verdicts about one
channel and both were right**, because the verdict was never about the channel.

`shadow` is the same story with the camera instead of the playhead: 0 px in both
directions at elevation 0 on every pose, **125 344 px** at elevation 35°. And
`assert-hero-flatstate.mjs` already had the reason written down — *"a contact
pool is a HORIZONTAL plane; at the beat's parked elevation it is edge-on"* — and
solves it by orbiting for that one row.

### `GATED` — the failure mode with no tell at all

`lit` reads 0 px in both directions on all four poses. Under DISPATCH §2.7 —
*"a dial whose label does not describe what renders is a defect — wire it or
remove it"* — that is a dead dial, and deleting it would have been the wrong
call. `components/viewport-3d.tsx:6430` multiplies the whole rim term by
`(1 − k)`, where `k` is the flat-ink blend:

```ts
RIM_BASE_STRENGTH * (1 + (litLaw.rimGain - 1) * lit) * (1 - k)
```

At `ink 1` that factor is exactly zero whatever `lit` is. A single-key arm on
`lit` asks the channel to act in the one state where it is arithmetically
switched off. Held at `ink 0`, the pair separates by **25 390 / 31 506 / 25 966 /
22 025 px** across the four poses.

> **A single-key OFAT arm on a gated channel is a dead arm with a live name.** It
> is the retracted row wearing different clothes: an arm that could not have come
> out any other way, reporting a verdict about the channel it names.

---

## 2. The reading that separates them, and it is not the one everybody takes

Every sweep in this repo measures an arm **against the shipped frame**. That
reading cannot see any of the three failures, because all three produce the same
0.

The reading that can is the **pair diff**: drive the channel to a LOW and a HIGH
value and difference the two arms **against each other**.

- both arms move the shipped frame *and* differ from each other → the channel is
  live and the row is evidence;
- one arm moves and the other does not → live, but the still arm asked for the
  state it was already in, and **that arm is not evidence**;
- the two arms are the same picture → nothing on this surface could have told
  them apart, whatever either one did to the baseline.

The last case is the one only a pair diff sees. Two arms that each move 25 000 px
against the baseline and are byte-identical to one another have measured their
**partner key**, not the channel — which is exactly what `{flat: 0, depth: 1}`
did, and no against-baseline number could have said so.

⚠ **And the pair diff has its own trap, found by running it.** `yaw −25` and
`yaw +25` each move the shipped frame by ~6 300 px and differ from *each other*
by **82**. That is geometry, not a defect: at `depth 0.004` the mark is a sliver
and `cos(+θ) = cos(−θ)`, so the two projections are near-mirror images. A
pair-diff rule that did not know this would call two plainly live channels inert.
**The pair diff is a reading, not a verdict** — the same sentence this file is
about, one level up.

---

## 3. The survey

Twenty-eight files call `setFlatten`. Three of them are this lane's own and are
excluded — surveying your own work is self-certification. The other **twenty-five
were read in full**, fanned out four ways, under explainer 31's rule: *every
verdict must carry a line number and a verbatim quote from that line.* Thirty-two
citations were then checked mechanically against the tree: **32 of 32 byte-match
at the cited line.**

### 3.1 · One file in twenty-eight reads what the setter returns

```
READS the boolean:  assert-stroke-schedule.mjs   (Lane M, landed 2026-08-07)
                  + _probe-laned-ofat.mjs, _probe-lane1-blank-tail.mjs,
                    assert-hero-flatstate.mjs    (this lane, same day)
DOES NOT:           the other twenty-four
```

The shape of the twenty-four is identical everywhere:

```js
await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
```

The boolean crosses the boundary and is dropped on the floor.

**And at least eight of those twenty-four check a DIFFERENT control's return, in
the same file, on the same run:**

| file | what it does check | line |
|---|---|---|
| `assert-pen-field-alloc.mjs` | `fieldRealloc()` read back and graded | `:127-130` |
| `assert-carve-graze.mjs` | `carveAA()` — *"the arm aa=0 … actually TOOK"* | `:138-152` |
| `assert-hero-live-shadow.mjs` | `if (!took) throw … "orbitView refused"` | `:162-163` |
| `_probe-carve-envelope-recal.mjs` | `if (!ok) { … process.exit(1) }` on `setCarveEnvelope` | `:190-193` |
| `_probe-carve-gpu-readback.mjs` | `setFieldRealloc`, `setCarveDebug`, `"the HARD arm actually took"` | `:134`, `:279`, `:264` |
| `_probe-carve-sweep-live.mjs` | `setCarveEnvelope` refusal is fatal | `:195-196` |
| `_probe-drawin-holes.mjs` | *"the envelope arm … actually TOOK"* | `:203-208` |
| `_probe-hero-pool-projection.mjs` | `projection()` read back and compared | `:85-89` |

**The discipline exists in the file and skips this one setter.** That is not
carelessness, it is history: `setFlatten` returned `true` unconditionally until
2026-08-07, so reading it proved nothing and everybody correctly stopped. The
fix landed; the twenty-four call sites did not hear about it. **A validator
nobody reads the answer of is a validator that is not running.**

### 3.2 · Two arms in the wild are in the `INERT HERE` class

Both are `jointBreak` as a single key at a mid-draw playhead — the exact pose the
table above measures at 0 px in both directions.

```
scripts/verify/_probe-drawin-holes.mjs:224   await setFlat({ jointBreak: 0 })
```
taken at `:163  const T = span.at + span.duration * PCT`, default 80 %, and
asserted to be mid-draw at `:166  say(ph.phase === "draw", …)`. The frame it
writes, `break0.png`, is what a downstream reader attributes from.

```
scripts/verify/_probe-lane3-blank-tail.mjs:198  await run("break OFF", () => …setFlatten({ jointBreak: 0 }), …)
```
taken at the playhead the sweep *chose because the mark is blank there* —
`:176  const blank = rows.find((r) => r.ink <= 4) ?? rows[rows.length - 1]`.

Neither has an opposite-value arm; both compare against an undriven `shipped`
frame. **Neither could have come out any other way**, and both are ancestors of
the row explainer 24 retracted.

There is a second-order finding in `_probe-lane3-blank-tail.mjs`, and it is the
better lesson: that file's whole header is an essay against the *other* blind
spot — *"OFAT is blind to a defect that fires in TWO passes at once"* — and it
fixes the power-set problem completely while leaving the inert-channel problem
untouched two lines below. **Closing one blindness does not survey for the
others.**

### 3.3 · What the survey also found, and did not expect to

- **No file passes an invalid key.** Every key in all twenty-five is one of the
  thirteen. The two exceptions are deliberate: `assert-stroke-schedule.mjs:1656`
  (`__laneMBogus`) and `:1658` (`flat`), each declared `"reject"` and each
  required to return `false`. **`{flat: 0}` was one typo, not a class.**
- **No PIXEL-graded arm in the twenty-five drives `lit`, `pitch` or `color`.**
  All three appear exactly once, in `assert-stroke-schedule.mjs`'s accept sweep
  (`:1639`, `:1646`, `:1647`), which grades the returned boolean and never takes
  a picture. So the validator knows those three keys are legal and **nothing in
  the repo has ever looked at what they render.** (The first draft of this line
  said they were "driven by none of the twenty-five", which is false and is the
  over-claim this file is about — the mechanical citation check caught it.)
- **Two files publish a number taken at a pose they do not record.**
  `_probe-carve-bounds.mjs` sets no playhead — `:15 await p.waitForTimeout(2500)`
  then straight to `:16 setFlatten({penCarve: 0.5})` — and `_probe-carve-register.mjs`
  does the same at `:48`/`:51`. Whatever beat the page happens to be on when the
  wait elapses is the pose, and it is unrecorded.
- **Camera elevation is stated in 2 of 25.** `assert-hero-live-shadow.mjs:48`
  and `_probe-hero-pool-projection.mjs:98`. Both are shadow gates, and both had
  to learn it the hard way.
- **`assert-stroke-schedule.mjs` §14 — the best control in the set — states no
  pose of its own.** Its playhead is inherited from `:1534 await seek(0.44)` and
  its camera from `:698 frontView(0.8)`, while the comment that explains its
  calibration cites a measurement taken on `/` at playhead 0.50. The rows are
  sound; the numbers quoted beside them are from a different surface, which is
  §9.3's defect surviving inside its own fix.

---

## 4. The law

> **A channel's OFAT verdict is a property of the surface, the pose AND the
> camera it was taken on.**

Measured on one page, one channel at a time, four poses:

| channel | DRAW 80 % | DRAW 96 % | settled, el 0 | settled, el 35° |
|---|---:|---:|---:|---:|
| `depth → 1` | 15 | 18 | 26 | **8 698** |
| `ink → 0` | 73 | 82 | 3 139 | **23 860** |
| `shadow → 1` | 0 | 0 | 0 | **125 344** |
| `jointBreak → 1` | 0 | 0 | **437** | **365** |
| `lit`, single key | 0 | 0 | 0 | 0 |
| `lit`, held at `ink 0` | 22 025 | 25 390 | 31 506 | 25 966 |

**Every one of the eleven numeric channels is live on at least one pose, and no
single pose makes all eleven live.** An OFAT table with no surface in its header
is not a table of channels. It is a table of one frame.

### The four rules that fall out

1. **Read what the setter returned.** It is one binding. An arm that never
   reached the render and an arm that reached it and changed nothing print the
   same number, and only the boolean separates them.
2. **Drive both directions, and diff the two arms against each other.** Against
   the shipped frame is the reading everybody takes and it cannot see any of the
   three failures.
3. **Where a channel is gated, hold the partner.** `lit` needs `ink < 1`,
   `shadow` needs the camera off elevation 0, `jointBreak` needs a playhead where
   the junctions exist. Then diff the pair, never the baseline — against the
   baseline both arms move by the partner's amount and the row reads healthy.
4. **Put the pose in the header, beside the number.** Derived from the page, not
   a constant — the rule `assert-hero-flatstate.mjs` already states about its own
   park: *"a constant standing in for a phase boundary is a row that reports on
   the beat's tempo instead of on the channel it names."*

---

## 5. What this does NOT close

- **Nothing outside `setFlatten` was surveyed.** `setPenTip`, `setPenTipShape`,
  `setCarveEnvelope`, `setCarveDebug`, `orbitView` and the rest have the same
  shape and were not read. The two neighbours that *do* validate
  (`setPenTip`, `setPenTipShape`) are quoted in explainer 24 §8 and are the
  reason this class was findable at all; whether their arms are taken on surfaces
  where their channels act is an open question.
- **The two `INERT HERE` arms are reported, not fixed.** `_probe-drawin-holes.mjs`
  and `_probe-lane3-blank-tail.mjs` are other lanes' files. The repair is not to
  wire anything — it is to move the arm to a playhead where the channel acts, or
  to say in the row that it could not have come out otherwise.
- **No gate enforces rule 1.** The meta-gate's channel J asks whether a judgement
  is withheld behind a flag; nothing asks whether a sweep reads what its own
  driver returned. That would be a new channel, and it is a real one:
  twenty-four files would fail it today.
- **Three channels have never had their PICTURE looked at** (`lit`, `pitch`,
  `color`) — legal by the validator, ungraded by every pixel arm in the repo.
  Counted, not fixed. This lane drove all three (`lit` 25 390 px held at `ink 0`,
  `pitch ±25` 3 121 / 3 099, `color` 25 461) in `_probe-laned-ofat.mjs`, which is
  a probe and not a gate.

---

## 6. The shape of it

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 29 asked, when the sweep ran it, how much of it ran. Explainer 31 asked
whether anything in the room was able to say no. Explainer 34 asked whether the
machine was listening for the word it used.

This one asks the question about the *arm* rather than the gate: **when the
instrument said "not it", was the thing it named even awake?**

For one row it was a typo, and that has been fixed twice over. For the other two
the arm was spelled correctly, the setter took it, the code under test was
perfect — and the answer was still decided before the measurement, by a playhead
and a camera nobody wrote down.
