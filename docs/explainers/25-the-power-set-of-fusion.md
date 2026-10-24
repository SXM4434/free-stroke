# 24 · The power set of fusion — and the two relationships that could not act

> *"there should be a fusion for every possible combo… there's like 7 styles… combos of 2 3 4 5
> 6 7… so it would be like 2 to the power of 7… for 2 there should be one fusion for every
> possible combo of two, etc"*
>
> *"slow weather and turntable dont animate"*
> — Sebs, 2026-08-04

Two asks, and they turn out to be the same ask twice. The first is about coverage: is there a
relationship for every way the systems can meet? The second is about whether a relationship you
can select actually *does* anything in the state you select it in. A cell that does not exist
and a cell that exists and reads dead are the same hole with different paperwork.

Research behind this: [`research/fusion-combination-space.md`](../research/fusion-combination-space.md).

---

## 1 · Two to the power of seven, and where the number comes from

The seven are the style panel's own tabs — **material · animation · texture · dither · ascii ·
layers · fusion** (`components/style-panel-scaffold.tsx:162`, `PANELS`). There are **eight**
entries in that array, and the one that is not a system is `presets` — a picker for the other
seven. It sits SIXTH in the array, not last, which is worth saying because "the extra one is the
last one" is the kind of thing that reads true and is not: the ids in file order are
`material · animation · texture · dither · ascii · presets · layers · fusion`.
Counting it would have produced 2⁸−1−8 = 247 cells for a seven-way question.

A *combination* is a subset. Fusion is systems influencing **each other**, so a subset of one
has nothing to be related to, and the empty set is "no fusion". That leaves

```
2^7  −  1     −  7        =  120
all    empty     singles
```

Broken out: **21** pairs, **35** triples, **35** quadruples, **21** fives, **7** sixes, **1**
that is everything. Sebs's arithmetic was right; the count is 120.

## 2 · What makes a system a *member* — and why it is measured, not declared

The temptation is to write `systems: ["texture", "dither"]` on each cell by hand. That is a
hand-copied inventory, which is the failure mode this repo has hit five separate times
(`scripts/verify/lib/inventories.mjs` exists because of it). So membership is **derived from
the links**, by one function, and the gate checks all 116 authored cells against it:

```ts
systemsOfLinks(links)  // -> the systems that appear at either END of a live link
```

A fusion link is one sentence: **SOURCE drives TARGET by AMOUNT**. So a system is in the
combination when it is one end of a sentence. Which panel each end belongs to is read off the
UI, not off intuition:

| end | system(s) | why |
|---|---|---|
| `breath` · `drift` · `event` | **fusion** | manufactured inside `style-fusion.ts` by `driveOf`, shaped by the fusion panel's own Drive / Swing / Speed dials. Nothing else generates them. |
| `textureField` · `ditherField` · `asciiField` | that **layer**, and **animation** | a phase source only advances while that layer is ANIMATING (`needsAnim`), and a layer's own animation is what the Animation panel is about — `ANIMATION_CATEGORIES` lists texture, dither and ascii by name. |
| `stackField` | **layers** | stack animation's controls live inside `LayersControl` (`:1449-1590`), not in the Animation panel. |
| `reveal` · `completion` | **animation** | `ANIMATION_CATEGORIES[0]` is *"Geometry — the form draws itself in — play it from the timeline"*, badged `playback`. The draw-in is animation. |
| `orbit` | **nothing** | the View is a preset FAMILY routed through `app/page.tsx`; it is not one of the seven tabs. This is load-bearing — see §5. |
| every target | its own layer, or **material** for the eight surface levers | plus `asciiFlow`, which also counts as animation because the shader only reads `uFsAscTime` inside `if (uFsAscAnim > 0.5 …)` (`ascii-shader.ts:412`). |

### Substrate is not membership

Two switches get turned on for reasons that have nothing to do with what a relationship is
*about*, and counting them as members would make almost every cell claim systems it does not
use:

- **`motionMode`.** `evaluateFusion`'s own comment calls it *"the substrate-level 'may style
  animate' switch"*. Every shipped fusion preset sets it, including ones that animate nothing.
  It is the clock, not a relationship.
- **`layerStackEnabled`.** `fusionWakePatch` switches it on for any composition with two or
  more screen layers, on its own measurement: **87.0 %** of the mark's inked area survives
  without a stack against **96.6 %** with one, and below that the mark reads as a black bar.
  That is legibility, not authorship.

So `layers` is a member when the **group's own animation drives something** — `stackField` —
and not merely when the stack is switched on to keep two layers legible.

## 3 · Four cells cannot exist, and that is arithmetic

Line up the 21 targets against the seven systems and something falls out immediately: **every
target belongs to texture, dither, ASCII or material.** There is no target that belongs to
animation, to layers, or to fusion. Those three are *sources*. Clocks.

Which means the four subsets made only of clocks —

```
animation+layers · animation+fusion · layers+fusion · animation+layers+fusion
```

— have nothing to write to. Their `FusionFrame` is the identity frame **by construction**, and
no amount of authoring changes it. They are not weak cells; they are cells with no picture in
them, and the honest thing is to ship them saying so rather than to leave four quiet holes in a
grid whose whole point is that it has none.

Measured on the real page, in the same window and through the same control as the other 116:
all four read a pixel signal of **0.000**, while the authored cells read **1.9 to 60**. That
is the strongest negative control in this whole gate, and it is one the *product* supplies
rather than one the test invents.

**Could they be rescued?** Only by giving one of those three systems a target. The candidate is
real and is named rather than hidden: **`stackBalance`** — a target driving the group's
`stackTextureOpacity` / `stackDitherOpacity` / `stackAsciiOpacity`. It would be a genuine
addition to the rail. It would **not** rescue these four, because with no screen layer in the
combination the stack is balancing nothing. It needs a `FusionFrame` field and a write in
`viewport-3d.tsx`, which is a different lane's file; it is handed over as a patch rather than
taken.

## 4 · The grammar the 116 are authored on

Coverage is the requirement; padding is the failure. `fuseEverything`'s note states the law
this rail was rebuilt around:

> Wire nine parameters to one breath and you do not get nine systems fused, you get **one
> throbbing object**.

So each cell is authored to four rules, and each rule is a gate row rather than a memory:

1. **Every member appears at a link end, and nothing else does.** `systemsOfLinks(links)` must
   reproduce the cell's own key. A cell that quietly reaches a system its name does not claim
   is a cell whose name is a lie.
2. **Drivers are spread.** At most two links on one source — and above that only when the
   combination genuinely has no second driver (the eleven camera-only cells, §5). `event` does
   not count as available unless the cell ships on Burst, because `fusionLinkSleep` says in so
   many words that Event is silent on Loop and Arc.
3. **Amplitudes fall as the cell grows.** 0.92 at two links, down to 0.58 at nine. Nine
   relationships at full strength is nine clamps.
4. **The composition is authored, not defaulted.** Each cell names its own pattern, screen,
   charset and body, so 116 cells do not arrive as one look with different wiring. Measured
   across the set: **12 of the 13 texture modes, all 10 dither types, 9 of the 10 charsets and
   12 of the 15 bodies** are in use, and no single choice carries more than a quarter of the
   cells that could have taken it. That is a gate row, because a lazy default spreading through
   116 entries is exactly how a set becomes one idea.

And one rule that is not about craft but about honesty: **a cell fully determines the
composition.** Selecting one resets every composition rail to its default first, then applies
the cell's own patch — the same rule `applyPresetToStyleState` enforces for every other
composition preset, and for the same reason. Without it, the `texture+dither` cell selected
after the `texture+dither+ascii` cell would still be wearing an ASCII layer, and its name would
be false.

### The composition is also a place a relationship can be invisible — one cell, measured

Rule 4 says the composition must be *authored*. One cell proved that authored is not the same as
**legible**, and it took the pixel gate to say so: `animation+texture+fusion` shipped as *Grain
Breath* — three links on `textureMode: "grain"` — and read **net 0.00** on the liveness gate,
then **0.072 over sixteen moments**, against its own sibling `animation+texture` at **8.526 in
the same run**. Every other authored cell cleared. Two causes, and `lib/texture-shader.ts` had
already written both down:

1. **One of its three links was dead by construction.** The grain-lattice note says *"grain is
   the one pattern whose period is NOT the authored constant — the LOD picks it from the
   footprint"* — `fsGrainCell` reads the pixel footprint and never `uFsTexScale`. So
   `reveal → textureScale`, a third of the cell's authorship, was writing to a dial the mode
   ignores.
2. **An incoherent pattern cannot hold still enough to be modulated.** A stochastic field
   translating under its own animation decorrelates every pixel, and the mark's sampled mean
   wanders with it. Measured with the relationship *switched off*: this composition's own drift
   was **L1 14.5 and tone 0.85** across a 90 ms gap — a noise floor higher than anything three
   links could put on top of it. The same note grades grain *"the weakest pattern on the
   board"*, one that *"does not reach the 5.0 'reads' line the other eleven presets now clear"*.

The cell is now **Cross Weave** on `crosshatch`, which answers both: a woven field keeps its mean
under translation, so its travel is a legible slide rather than a re-roll, and all three targets
land on something the mode can move — intensity is how much of the weave survives, contrast how
hard it prints, a phase push slides it. Measured on the same instrument in the same window:
**0.072 → 15.934** (L1 35.8 against a drift of 19.8; tone 1.62 against 0.59 — *both* channels
separate, where grain separated on neither). Crosshatch was also the least-carried pattern in the
set at two cells, so the move spreads the palette instead of crowding it, and grain keeps eight.

**The rule that comes out of it, and it is the one this whole file is about:** *not measurable*
and *not visible* are the same sentence. A relationship whose picture is a boiling speckle is not
a quiet relationship, it is an invisible one, and it fails Sebs's own test — a relationship that
looks dead is dead — long before it fails a gate. The gate is what noticed; the eye is what
agreed.

### …and an invisible cell was hiding a duplicate one

A second cell, `material+dither+layers+fusion`, was the weakest live one in the set — signal
3.204 against a drift of 1.498 — and at full res the eye agreed: a clean stroke wearing a
halftone you could not see. It was a halftone on **ceramic**, *"white porcelain under a hard
glaze"*, and a halftone THRESHOLDS luminance, so on a body that bright the screen resolves to
uniform white. Its own concept ends *"turning the mark hardens the cut"*, and there was no cut to
harden.

**The first fix was wrong, and only the eye caught it.** Widening `ditherThreshold` to 0.72 more
than doubled the meter — net **1.7 → 8.3** — by giving the link a wider range to swing through,
and made the picture *emptier*: the stroke came back a featureless white with less screen visible
than before. The number improved while the read got worse. The threshold was put back and the
range taken from scale, contrast and the stack actually carrying the layer, which measures a
more modest **3.3** and is the version where the dots are there. Both runs are kept —
`fusion-combos/diag-slip` is the rejected one — because a counter-example is worth more on disk
than in a sentence.

**And with the screen finally visible, the distinctness gate found what the invisibility had been
covering.** The cell landed **5.92** from `material+dither+fusion` — the closest pair in the set,
down from 12.37. Side by side the resemblance was never the tuning, it was the authoring: the
same body, the same `drift → wet` link, two screens from the same dot family, and two names one
word apart — *Slip Glaze* and *Slip Screen*. That is the padding failure this whole set is gated
against, and it does not stop being one idea twice because a meter cleared a floor.

The two cells differ by exactly one member — **layers** — so the fix came from the cell's own
loudest link rather than from a wish to be different. `stackField → ditherFlow` means *the group
slides the screen*, and sliding an isotropic dot field only makes it shimmer, because a grid of
dots looks the same one dot along. Travel reads on a **directional** screen. So the cell is now
**Press Run** — a line screen dragged across the mark like a plate pulling through a press — on
`matteClay`, which also gives the screen a mid-tone to cut into. `wet` survived the move because
its `needs` is `null`: it works through `colorScale`, roughness, env and clearcoat, so it darkens
any body rather than needing a glaze to sit on. Slip Glaze kept its body, its screen and its
name; nothing was taken from it.

Three cells, three different lessons, and the same shape each time: **a cell can satisfy every
structural rule in §4 — derive its own key, spread its drivers, fall inside its amplitude
ceiling, author its own composition — and still be a cell you cannot see, or a cell you have
already seen.** Neither of those is caught by the model. Both were caught by pixels and an eye.

### …and then the eye's criterion turned out to be four things, three of which are mechanical

**The duplicate count in this set is THREE, not one.** The pair above was found by looking, and
what the looking actually named was four properties: the same body, the same link, two screens
from the same family, and two names one word apart. Three of those four are mechanical, and
nothing was checking them — so the two that shared only three of the four went out with the set.

**Duplicate 2 · `material+animation+dither+ascii+layers`, shipped as *Wire Desk*.** It was
`Read Out` on the identical body, screen and charset, carrying three of its four links VERBATIM,
with a fourth differing only in which ASCII weight it drove — and a concept sentence that was
Read Out's sentence with a clause bolted on the front. The one thing it did not share was a name
word, which is precisely why the eye that caught Slip Screen walked past it.

**And their crops measure 38.30 apart**, against a closest pair of **10.46** in the same run. Both
cells genuinely do render differently: a drifting Bayer matrix is visible. That number is the
whole finding —

> Pixels answer *do these look alike*. They cannot answer *are these the same idea*. A pair 3.7×
> further apart than the closest pair in the set was still one idea twice.

It is now **Stop Down**, and the re-authoring takes the member the two cells differ by and makes
the GROUP the whole idea rather than one more driver on Read Out's body: the stack's own envelope
(`stackAmount`, which `FusionSignals` folds into the Stack source precisely so a stack behaviour
that only fades "would otherwise be silent") becomes an aperture, on `pulse` — the one stack
behaviour no cell in the set was using. New body, new screen, new charset, new drivers; nothing
carried over. Read Out is untouched.

**Duplicate 3 · `material+animation+texture+dither+layers+fusion`, shipped as *Plates Only*.**
Found by the gate written for duplicate 2, **on its first run**. It was `Damp Plates` plus a body:
both composition rails carried across unchanged (`contour`, `dotScreen`), three of five links
verbatim, and two concept sentences opening with the same four words — *"Two plates and no
type"* / *"Two plates, no type."*

And the body it bought was `ceramic` — luminance **223** — under a dot screen. That is the
identical fault §4 above had already spent a diagnosis on: *a halftone thresholds luminance, so
on a body that bright the screen resolves to uniform white*. **A dot screen was shipped onto
ceramic twice, in the same set, after the first one had been written up.** A finding recorded in
prose does not propagate; only a gate row does.

It is now **Sizing** — the two plates hold still and the ground moves under them — on `wax`, with
`ripple` (the least-carried pattern at three cells) and `hatch` instead of a second dot field.
Damp Plates is untouched.

**What comes out of it is a rule about the instrument, not about these three cells:** the eye's
criterion, once you write it down, is usually mechanical enough to be a gate — and until it *is*
one it only catches the instances that happen to carry all of its signals at once. §7 has the
gate.

### A fourth cell, and this time the floor caught it — by 0.08

`animation+dither+layers` — *Lockstep* — read **net 0.92 against a floor of 1.0**: L1 signal 11.74
against a control of **10.82**, tone 0.116 against 0.050. Quiet on both channels, which is the
shape of a link writing into a field that cannot show it.

The obvious diagnosis needed no new theory, because every other cell carrying the same link clears:

```
Line Drift      lines     stackField>ditherFlow 0.80     net 14.84
Terminal Roll   lines     stackField>ditherFlow 0.60     net 41.43
Press Run       lines     stackField>ditherFlow 0.55     net 17.60
Lockstep        diamond   stackField>ditherFlow 0.70     net  0.92
```

The only thing separating them is the screen family, and Press Run's own note — written two
diagnoses earlier — already states the law: *sliding an isotropic dot field only makes it shimmer;
travel reads on a **directional** screen.* A diamond screen is a rotated square lattice, so that
read as a third instance of one mechanism.

**It was wrong, and the re-measurement said so: `diamond` → `hatch` came back at 0.775, worse.**
That failure is where the real diagnosis is, because the new number was `netL1` **exactly 0.00** —
signal 15.779 against a control of 15.817. Not small. *Zero.* `stackField → ditherFlow` contributes
nothing to where the ink is **on any screen**, because `animation` is a member: the screen is
already translating under its own crawl, and a second translation of a periodic field is that
field at another phase. A link that measures exactly zero should be **removed, not re-tuned**.

The cell one member down then gave the answer, reading 104× louder on tone through the *same*
link on the *same* screen:

```
Hatching Up   animation+dither          toneSignal 16.977   net 135.24   per-moment 131.7 139.7 133.4 136.2
Lockstep      animation+dither+layers   toneSignal  0.163   net   0.78   per-moment   0.8   3.7   3.6  -0.1
```

Hatching Up's loud channel is not its oscillator — look at how *flat* its per-moment nets are. It
is `reveal → ditherThreshold` at −0.55, and on a finished mark `reveal` rests at 1, so that is a
large **constant** offset to the threshold. Lockstep had no constant lever at all: two travel links
(invisible here) and a small oscillator.

> **The rule, and it generalises past this cell:** in a combination where a layer already animates
> itself, a link that adds *travel* to that layer is writing into a channel that is already full.
> The levers that still read are the ones that change *how much ink there is* — threshold, bite,
> amount — not *where it is*.

So the group gets the threshold: `stackField → ditherThreshold`, which is both the loudest
available lever and the idea the `layers` member is actually for — *the group opens and closes the
screen*, a different sentence from Hatching Up's *the draw raises the bar*. And
`stackDitherOpacity` goes to **1**, for the reason Press Run's note already gave: `fusionWakePatch`
lands the stack at **0.55**, so every one of this cell's links was being attenuated by the stack
its own membership had switched on. The angle moves off Hatching Up's 30 so the two do not wear
one picture.

**Measured on the same instrument, same window: 0.775 → 95.216**, with Hatching Up unchanged at
135.1 — so the fix is scoped to the cell and did not move its sibling.

> **But the number that matters is not 0.92, it is 1.07.** That is what this cell measured in the
> *previous* run — against a floor of exactly 1.0. It was never clear of the bar; it was inside the
> instrument's own run-to-run variation and it passed by luck. **A margin of 7 % on a measurement
> that moves 14 % between runs is not a pass**, and the honest reading of the earlier green row is
> that nobody had looked at the margin. A gate tells you which side of a line you landed on; it
> does not tell you that you were standing on the line.

## 5 · The hand family — and the relationship that rested at exactly zero

Eleven cells — every subset of {material, texture, dither, ascii} with no animation, no layers
and no fusion — have **no clock available at either end**. The only source left is `orbit`.

That is not a consolation prize, it is the product's own thesis: a drawing becomes an object you
turn. These are the relationships that answer *your hand* rather than a timer, and they are the
only ones on the rail that keep working with motion mode off.

They also inherit `viewTurn`'s defect, which is the second half of Sebs's message.

### Why Turn Table looked dead

```
orbit  =  atan2(camera.position.x, camera.position.z)      viewport-3d.tsx:4954
src    =  phaseTriangle(orbit, 2π)
```

`phaseTriangle` carries a deliberate quarter-period offset so that **rest is zero**. That
offset is itself a defect fix: without it `phaseTriangle(0)` is `+1`, so every layer whose
animation was off sat pinned at full scale *and at the same value as every other one* — four
dropdown entries producing one identical signal, measured 2026-08-01.

The page loads head-on. Head-on, the azimuth is 0. So

```
phaseTriangle(0, 2π)  =  |((0/2π + 0.25) mod 1)·2 − 1|·2 − 1  =  |0.5 − 1|·2 − 1  =  0
```

**Exactly zero.** Not quiet — zero. All three of Turn Table's links multiplied by nothing, and
went on doing so until something turned the mark. Sebs clicked a relationship that could not act
in the state he clicked it in.

The repo already knew and had worked around it in the *instrument* rather than the *product*:
`_probe-fusion-sheet.mjs` frames every arm at 38° with the comment *"viewTurn … rests at the
head-on angle by design, so a head-on capture of it is a capture of its resting state"*. The
probe compensated. The product did not.

### The fix, which is the one this file already makes everywhere else

A fusion is a statement that these systems are related, so selecting one **puts the systems it
needs on**. That is `fusionWakePatch`'s entire job — it switches on the layers, the animations,
the dither's travel direction and the body a fusion's own links require, derived from the links
so a source added tomorrow is woken tomorrow.

The View was the one system that wake could not reach, because **the camera is not style
state**. So the wake now reports it separately:

```ts
interface FusionWake { patch: Partial<StyleState>; turnsOn: string[]; spin: number }
```

and `app/page.tsx` — which owns the viewport API — starts the turntable at **12°/s**, the same
number the Portfolio Spin view preset already ships (filmed at Δpx 72.64). Additive: it starts
the turntable when a relationship needs one and never stops one you set yourself.

The panel says so too. `fusionLinkSleep` now reports *"nothing is turning the mark, and this
source IS the angle you are looking from — head on it rests at exactly zero"*, with the one
press that cures it, beside the reasons it already gave for a sleeping layer.

> **One subtlety worth writing down.** The model cannot see the camera, so the reason is only
> reported when the caller explicitly says the camera is still. `undefined` means *"I do not
> know"* and stays silent — a model-side gate with no camera must not manufacture a sleep
> reason out of its own ignorance. `assert-fusion-combos.mjs` §5 drives all three arms (0, 12,
> unknown) and requires the reason to appear, disappear, and stay quiet respectively.

### And Slow Weather

Measured rather than assumed. On its shipped shape (**Loop**, which is what selecting it lands
on) Slow Weather moves four frame fields with a worst excursion of **0.86** — it is alive, and
the "quietest cell on the liveness gate (0.97 on Burst)" note its author left is about **Burst**,
not about Loop. On Burst its ambient allowance drops to `BURST_AMBIENT = 0.2` and it has **no
`event` link**, so there is nothing for the shape to fire: an all-ambient relationship on the
shape whose whole idea is discrete impulses.

That is a real defect and it is *not* fixed by editing Slow Weather, because the dispatch
contract's §0.7 (`portfolio-system-lab/docs/system/AGENT-DISPATCH-CONTRACT.md`, outside this
repo) is explicit that improving a read in place destroys the version Sebs can still pick. Slow
Weather is untouched. The answer is a **new** cell at the same address — `material+texture+fusion`
is Slow Weather's own combination, derived from its links — and that cell, *Static Chrome*, ships
on Burst **with** an `event` link, so the shape has something to do. Both are one press apart
and the picker names Slow Weather on the cell as "also on the rail".

The general rule came out of it and is now a gate row: **no cell ships on Burst without an
Event link, and no cell carries an Event link on a shape that is silent for it.**

### Both dials, on pixels, both arms — and the thing the eye saw that the meter did not

Everything above is the MODEL. Sebs did not read a frame struct; he looked at a mark, and *inert
in the state he viewed it in* is dead. So `_probe-fusion-two-dead.mjs` films five arms on the real
page on the real GPU through the real selection route, and `assert-fusion-two-dead.mjs` grades
them. Two independent runs (`v1`, `v2`), 11 rows each, all pass:

| arm | net | what it is |
|---|---|---|
| `viewTurn` head-on, spin 0 | **0.13** | the state Sebs was standing in — dead |
| `viewTurn` through the pill | **39.23** | the route now starts the turntable itself: `cameraSpin` reads 12°/s and the probe never set it |
| `slowWeather` on Loop | **53.22** | alive on the shape selecting it lands on |
| `slowWeather` on Burst | **5.05** | 10× quieter — the defect |
| `Static Chrome` on Burst | **72.50** | the new cell, alive on the shape that killed the other |

**The repaired turntable is the strongest argument for two channels this repo has produced.** Its
L1 *control* is LOUDER than its signal — netL1 **−20.8** — because the fix IS a turntable, and a
mark on a turntable already changes as you orbit it. Only tone separates (netTone **+4.9**). An
L1-only instrument would have reported the fixed dial as dead and sent someone to fix a fix.

**And then the contact strip said something the `net` figure could not.** Slow Weather clears every
liveness bar on Loop and still reads *pale*. The measurement that explains it is the mark's own
mean luminance against 255 paper:

```
viewTurn (either arm)     ink 179–185     tone travels 0.05 → 25.57
Static Chrome  (burst)    ink 182         tone travels 10.46
slow weather   (loop)     ink 222         tone travels  4.96
slow weather   (burst)    ink 222         tone travels  0.76
```

Slow Weather's body sits **~40 luminance units brighter than every other arm**, so a genuine tone
swing has to happen in the narrow room between a nearly-white mark and white paper. That is the
same shape as the halftone-on-ceramic fault this set has now been burned by twice — and it means
the honest verdict on *"slow weather dont animate"* is neither "it's fine" nor "it's broken":

> It **is** alive on the shape it lands on, and it is **quiet because of the body it lands on,
> not because of the relationship.** The louder answer at the same address is one press away.

Whether that is enough, or whether Slow Weather wants a darker body, is a taste call and it stays
Sebs's — §0.7 means nobody else may quietly re-tune a relationship he can still pick. Both numbers
are printed by the gate rather than asserted, because there is no defensible bar for *can I see
it* and inventing one would be worse than saying so.

## 6 · Why the interface is seven chips and not 120 pills

120 pills is not an answer, it is a wall. This panel has already lost its dials below the fold
once, when nine pills wrapped to two lines — caught by `assert-fusion-ui.mjs`, not by eye.

> **AND THIS FEATURE DID IT AGAIN, TO THE SAME PANEL, WITH THE SAME OUTCOME.** The picker shipped
> directly under the rail, on the reasoning that it *is* the rail continued. It is seven chips, a
> name, a concept, a sentence per link and a browse button — five or six rows that are always on
> screen — and with it there, `assert-fusion-ui.mjs` measured **Link, Swing and Speed all clipped
> out of the panel body**, along with every one of their explanations. The dial that answers *"why
> is nothing moving"* was the dial you could not see.
>
> The fix is a rule the file already had written down two blocks lower, for the editor: **shallow
> controls first, deep surface last.** The picker moved below the dials. What is worth keeping is
> not the fix but the count — **twice now, this exact defect has been invisible to whoever added
> the block and caught only by the instrument.** A tall block added to a bounded panel does not
> announce what it pushed off the bottom.

The generative-design literature has a name for both halves of this: the space is a
*combinatorial explosion*, and the interface answer that works is a **design-space explorer** —
you state what you want and the space collapses, rather than browsing and filtering a flat list.
The synth-preset community's verdict on the flat-list answer is not kind; the recurring report
is finding "only 1 or 2 sounds that work" per browse.

Our version is unusually clean because **the query is already on screen**: the 120 are indexed
by a 7-bit key whose bits are the tabs at the top of the same panel. So the picker is seven
chips. Press Texture, Dither and Material and the cell for that combination is named underneath,
with its concept, its relationships read back as sentences, and — where one exists — the shipped
relationship that already answers the same address.

The flat grid is still one press away, grouped by how many systems each cell fuses, because a
set you cannot see whole is a set you cannot judge. That is what the contact sheets in
`docs/verification/fusion-combos/` are for, and it is the only place the eye can do its job.

## 7 · How this is proved, and what makes the proof able to fail

Five instruments, because the model grading itself is the exact defect this repo keeps finding:
the model, the pixels, the DOM, the set as a set, and the two dials by name.

**`assert-fusion-combos.mjs` — the model.** 33 assertions across nine sections: the set is
exactly the power set; membership derives back to the key; the composition switches on the
members and only the members; the derived wake has nothing left to add; every authored cell's
frame travels; the four empty cells are empty by arithmetic; both arms of the View reason;
drivers spread and amplitudes fall; Event only on Burst; every cell has a name of its own; the fusion
turntable speed IS the shipped view preset's speed (one number, not two — pinned against a
module this lane does not own, so moving my own constant cannot move both sides of the
comparison, which is the meta-gate's channel D); and every pre-existing preset id still on the
rail. **Six of those rows are calibration arms that must fail on a known-bad** — a
relationship at Link 0, a phase link on a layer that is not animating, a cell with its
composition stripped, a `glow` link bolted onto a cell with no material member, four links on
one breath, and nine links at 0.95.

One of them deserves calling out, because it is the shape of the original fusion bug:

> a phase source whose layer is not animating is pinned at `phaseTriangle(0) = 0` by design, so
> the relationship multiplies by exactly nothing.

Feed that to the traveller and it must report STILL. It does. **An instrument that cannot
report a dead relationship cannot certify a live one.**

**`_probe-fusion-combo-liveness.mjs` + `assert-fusion-combo-liveness.mjs` — the pixels.** Every
cell is selected through the real control on the real page on the real GPU, and the mark is
measured. **The obvious measurement does not work, and both ways it fails were measured on this
probe's own first three runs:**

- A **camera-driven** cell filmed on a free-running turntable read *linked 350.8 against
  unlinked 349.5*. It was measuring three.js's specular response.
- A cell with an **animated layer** has a crawling screen underneath it, so the unlinked arm
  travels just as far: `animation+texture+ascii` read *linked 160.8 against unlinked 186.6* —
  **the control louder than the signal.**

So the question is asked at ONE MOMENT rather than across a window. Hold the camera, take three
captures one short gap apart, and toggle the LINK dial between the first and second:

```
A   link 0.6   ┐ signal  = |A − B|    the link, plus one gap of drift
B   link 0.0   ┤
B'  link 0.0   ┘ control = |B − B'|   ONE GAP OF DRIFT AND NOTHING ELSE
```

Both spans are the same length, and the **control is taken with the relationship switched off in
both halves** — so it contains exactly the confounds (a crawling screen, a scrolling glyph grid,
any ambient motion) and none of the thing being measured. The verdict is on `signal − control`.

> A fourth version used two *linked* captures as the control, and that was backwards: with the
> relationship on, the control carried the fusion's own motion and read almost as loud as the
> signal (`texture+fusion`: 49.8 against 44.8). `fusionIntensity` 0 is the honest null, because
> `evaluateFusion` returns the identity frame there.

This is also strictly stronger than a travel measure, because it catches a **constant** push: a
`reveal` link on a finished mark sits at full deflection and never moves, which reads as dead to
anything measuring change over time. Explainer 15 records the same trap from the other side —
*"a slow effect and a dead one are identical in a frame-to-frame delta"* — and had to add a
`spanDelta`. Asking the question at one moment removes the dependence on speed entirely.

### And then it needed a second channel, because one is blind

The L1 per-pixel distance still could not see a whole family of cells, and the failure is
instructive. **90 ms of ASCII scroll is about 1.7 device pixels, and every glyph edge in the
field moves** — so by L1 the frame is completely different whether or not anything is coupled.
Measured: `animation+ascii+layers` read signal 44.66 against drift 47.05, and
`animation+dither` read 11.99 against 12.73. Twelve cells the model says move read a net of
**0.000**, and the reason was the ruler, not the cells.

So there are two channels, each with its own drift control, and a cell is live if **either**
separates:

| channel | what it sees | what it is blind to |
|---|---|---|
| **L1** — mean per-pixel distance | anything that moves *where* the ink is: a sheared pattern, a travelling band, a matrix pushed sideways | a tone change spread evenly over the mark |
| **tone** — difference in the mark's own mean luminance | density, threshold, contrast, ink weight — anything that moves *how dark* the mark is | a shear, a flow, a band; a scroll is invisible to it, which is the point |

The same cell on the same window, once the tone channel exists:
`animation+dither` tone **16.98 against a drift of 0.08** — 200×, where L1 read the control
louder than the signal. `animation+ascii+layers` **6.54 against 0.33**.

The gate asserts that the second channel is **load-bearing** — that some cells clear on tone and
not on L1 — because a branch that never decides anything is decoration wearing the name of a
safeguard.

Three smaller rules, each a defect this repo has already shipped: the camera spin is **reset
before every cell** (it leaked across a whole run once, and a leaked piece of state is the
difference between an instrument and a rumour); every crop is **composited onto the real paper
before it is measured**, with the alpha fraction recorded — a fusion lane's first contact sheet
composited a transparent canvas onto black and read it as *"creating a fusion shreds the mark"*;
and the verdict requires the net to be positive at a **majority of moments**, not just on
average, so one loud sample cannot carry a cell.

**`assert-fusion-combo-ui.mjs` — can a person get there.** The liveness probe presses
`__styleHarness.selectFusionCombo`, which is a state injection — the right instrument for
measuring pixels and the wrong one for "can Sebs reach this". A state-injection test has passed
in this repo while a whole feature was unreachable by a human. So this one **clicks**: it opens
the panel by pressing the chip, presses the system chips, opens the browse grid, and **clicks
all 120 cells, requiring each to put the rail on its own combination** — 120 clicks, 120
distinct selections. A grid whose buttons all did the same thing, or nothing, cannot pass that.

It also found a defect in my own instrument, which is worth recording because it is the shape of
every other one in this file: `__styleHarness.cameraSpin()` closed over a **render-time value**,
so a gate that set the spin and read it back in the same tick got the old number and the
turntable fix read as broken. The state drives React; anything asking out of band reads a ref.

**`assert-fusion-combo-distinct.mjs` — is it 116 ideas, or one idea 116 times.** This is the
gate the brief's warning about padding actually needs, and this repo had already invented the
measurement. [Explainer 15](15-screen-layer-quality.md):

> **nearest-sibling distance** — how far a preset is from the closest *other* preset on the same
> rail. That number is the difference between "this effect works" and "this effect is worth
> having". An option can change pixels convincingly and still be the option above it under a
> different name.

It found two real duplicates on the screen-layer rails (`woodgrain` against `scanlines` at 4.80,
`pixelSignal` against `hardThreshold` at 1.62), which were **re-authored rather than deleted**.
The same measurement runs here over the crops the liveness probe already saved, within each
camera population separately (comparing a 0° frame with a 38° frame would score two cells as
distinct because of the camera). Its known-bad is a crop compared with itself.

> 🔴 **AND FOR FOUR RUNS IT COULD NOT FAIL ON ITS OWN QUESTION.** `nearest` was computed, printed
> at the bottom of the output, and **never asserted**. Re-run over every capture on disk, `v1`
> through `v4` each print *"ALL 4 ASSERTIONS PASS"* — **including `v3`, the run that contained the
> 5.92 duplicate.** The row that says "no authored cell is within the floor of another" did not
> exist; only the rows about the four empty cells and the self-comparison did. That is the
> eleventh instrument in this repo to report green while measuring nothing, and it is the
> *construction* class — born unable to fail, which no amount of deriving windows from the model
> would have helped.
>
> 🔴 **AND THE FIRST THING THE NEW ROW DID WAS TEACH ITSELF A SECOND LESSON.** It went red on
> `material+layers` against `material+layers+fusion` at **4.33** — and those two cells had not
> changed. Measured across every capture on disk:
>
> ```
> prior-v1  8.93   prior-v3  9.90   prior-v4 10.46   v7  8.88
> v8       14.30   v9       20.88   v10       4.33
> ```
>
> **A fivefold spread on an unchanged pair.** Not noise — structure. Each cell runs on its own
> stack clock (`drift` on one, `loop` on the other) and a crop is one MOMENT, so where that moment
> falls in two independently-phased oscillators decides whether they look alike. A single-sample
> comparison of two self-animating cells is not a point estimate of anything.
>
> So the verdict now requires the finding to **reproduce**: a pair close in one run is printed
> loudly and not failed; a pair close in two or more is a duplicate. That is the same discipline
> the liveness gate already applies to its own four moments — *positive at a majority, not merely
> on average* — and it is stricter, not laxer: requiring a result to reproduce is a higher bar than
> accepting the first run that agrees with you.
>
> The row exists now, and **the floor moved 3.0 → 4.80**. 4.80 is not a number chosen here: it is
> what explainer 15 called a duplicate and re-authored. The old 3.0 was argued down on the grounds
> that these cells differ by composition as well as relationship — which is true and points the
> other way, because more axes of difference make a close pair *more* damning. Its calibration arm
> enters one cell's crop twice under two names and requires the row to flag it; run against `v3`
> at `--floor=6` it correctly goes red and names the 5.92 pair.

**`assert-fusion-combos.mjs` §9 — is it 116 ideas, asked of the AUTHORING.** The gate above and
this one look like the same question and are not, and the number that proves it is **38.30** — how
far apart *Read Out* and *Wire Desk* measure while being one idea twice (§4). A pixel gate cannot
reach that, however good its floor is.

So §9 asks the structural form of what the eye actually named when it caught Slip Screen: **is a
cell its one-member neighbour's composition and wiring, with a wire added** — the same body, the
same value on every composition rail the smaller cell sets, and a strict majority of its links
carried over. Every cell in a power set is one member from a neighbour BY CONSTRUCTION, so being
adjacent is structure; sharing the picture *and* the wiring is padding. Both thresholds are read
off the two duplicates this set has actually produced rather than chosen: at least two composition
rails identical (one shared dial is one shared dial), and at least two links, more than half.

The two-rail bar opens one hole and it is closed rather than noted: a cell with no material member
can only author fields from one family, so `dither+layers` could carry **every** link across an
identical screen and never be looked at. There is no such pair today — measured, zero at any field
count — which is exactly when a hole is worth closing, because nothing has to be re-authored to do
it. **Total carry-over is padding at any field count**: if not one relationship was re-thought, the
picture being one dial wide is not a defence.

Its known-bad is **not a synthetic mutant** — it is Wire Desk, restored exactly as it shipped,
into a throwaway two-cell set. A second arm requires plain adjacency NOT to fire, because a row
that called every neighbour a duplicate would go red 380 times and mean nothing. And fifteen pairs
that clear one bar but not both are **printed rather than dropped**, because a threshold that
hides its own neighbourhood is how a bar gets quietly lowered.

**`_probe-fusion-two-dead.mjs` + `assert-fusion-two-dead.mjs` — the two dials, by name.** Five
arms, both directions, on the real GPU; the numbers and the two-channel argument are in §5. It
refuses to produce numbers at all if the renderer string contains SwiftShader, because a software
rasteriser silently pauses the rAF loop and **a frozen animation and a still one are identical in
a screenshot** — which is the one failure that would make every row in it a lie. Its known-bad is
built in and is a real state rather than a mutant: `viewTurn` selected head-on, which it must
report dead (0.13) before it may certify the fixed arm alive (39.23).

### One thing about the set that is a choice, and is left as a dial

114 of the 120 cells ship on **Loop**; six ship on Arc or Burst where the concept demands it.
That matches the shipped rail exactly — `FUSION_BASE` puts every one of the fourteen built-ins
on Loop, with the reason written down: *"Loop is the default shape because it is the only one
that is unconditionally alive."* Every cell supports all three shapes and the Drive dial is
directly underneath the picker.

It is worth naming as a risk rather than glossing it, because
[`research/material-fusion-stack-timing-craft.md`](../research/material-fusion-stack-timing-craft.md)
§5 records the exact failure: *"Six of the eight fusion presets … are a bare continuous sine in
the 0.9–3.0 rad/s band with no hold, no anticipation and no lag between driver and driven. They
are not too small … They are **rhythmically identical**, which is why turning one on and
switching between them feels like nothing changed."*

What keeps the 116 out of that trap is not the Drive dial, it is the **drivers**: **68** distinct
driver-sets across 116 cells (69 before the three re-authorings in §4 — re-measured after them
rather than carried over), and only **three** cells whose drivers are breath and drift alone.
The rest run on a layer's own phase, the stack's clock, the draw, the finish, or your hand — five
rhythms that have nothing to do with fusion's sine. Whether more cells should ship on Arc is a
taste call and it stays Sebs's; the shape is one press away on every one of them.

The difference is measured **over the mark**, not over the frame: the stroke covers ~3 % of the
crop, and averaging a change on the ink across 97 % of untouched paper divides the signal by
thirty. That is [explainer 15](15-screen-layer-quality.md)'s "tone window five times wider than
its subject" in a new coat.

## 8 · What is still open

- **`stackBalance` as a target** (§3) — needs a `FusionFrame` field and a write in
  `viewport-3d.tsx`. Handed to the controller as a minimal patch; it is a real addition to the
  rail and it does not rescue the four empty cells.
- **Per-target ranges on `FUSION_TARGETS`** — `applyCustomLinks` carries one hand-written clamp
  per target (`asciiCell` 0.55x..1.45x, `colorScale` 0.25..1.6, `shineBand` ±0.95). SynthLab's
  forty-year-old SDK reached the general form first: a transform declared on the destination.
  Worth converging on; it touches every target, so it is a refactor rather than a feature.
- **The eight hand-written relationships cannot be mapped onto the grid.** Terminal Gel through
  Glitch Ribbon are switch-case branches with no link list, so `systemsOfLinks` cannot classify
  them and a hand-written table of them would be the inventory-that-drifts this file keeps
  naming. Only the six link-authored built-ins appear as "also on the rail".
- ~~**`FusionPreset` is a closed union in `lib/style-system.ts`**, which belongs to another lane,
  so `comboFusionKey` carries one documented cast.~~ **CLOSED 2026-08-07.** One lane now owns both
  files; `| \`combo:${string}\`` is declared beside the `| \`custom:${string}\`` arm and the cast
  is deleted rather than documented — a cast with a note explaining why it is safe is still a
  place the compiler has stopped checking. tsc holds at the baseline of six.

- **Slow Weather's body is why it reads quiet, and that is Sebs's call** (§5). Its mark measures
  **ink 222 against 255 paper** — ~40 luminance units brighter than every other arm filmed — so a
  real tone swing of 4.96 happens in almost no room. §0.7 bars anyone else from re-tuning a
  relationship he can still pick, so it is surfaced rather than changed: *does Slow Weather want a
  darker body, or is Static Chrome at the same address the answer?* Recommendation: leave it. The
  louder cell is one press away and named on the picker, and a body change would alter a look he
  has already seen.

- **Fifteen neighbour pairs clear one of §9's two bars but not both**, printed by the gate on every
  run. None is a duplicate under the criterion the two proven ones establish; several are close
  enough that a taste call could go either way. They are a list to look at, not a defect list.
