# Explainer 52. Six zeros that were the subject, not the control

Lane G3 set out to answer one question for every control on `/`: **if a user clicks this,
do the pixels change?** The census is in `docs/verification/feature-census/`. The headline
is that 0 of 165 controls and 0 of 157 presets are dead.

This file is about how nearly it said something else.

**Six separate arms read `0` before they read the truth. Not one of the six was the
product.** Explainer 51 is the same class from the other side, nine instruments in one day.
The difference worth writing down is that these six were not broken instruments. Every one
of them measured exactly what it was pointed at. **They were pointed at the wrong thing.**

---

## The six

### 1 · The value was not a value

```
setStyle({ materialAnimationType: "shine" })     ->  0 px over 2.4 s
setStyle({ materialAnimationType: "shineSweep" }) -> 9,683 px
```

The union member is `shineSweep`. `shine` is not in it. React took the write, the state
object carried a string nobody matched, the switch fell through to the still branch, and
the render was a perfectly good picture of nothing happening.

Same shape, one field along: the Texture panel's Pattern picker writes **`textureMode`**,
and there is also a **`textureType`**. Setting `textureType` alone left the select reading
`None` and the surface bare, at 0 px.

It happened a third time on the lab. `setPenTip("round")` and `setPenTip("wedge")` both
left the tip on `reed` and the frames read 0, and I nearly wrote that two of the six pen
tips are dead. The six are `off · cut · nib · quill · reed · chisel`. **`setPenTipMode`
refuses an unknown mode and RETURNS FALSE** (`lib/pen-reveal.ts:994`), so the product told
me and my probe was reading `penTip()` instead of the return value. The product was honest;
the probe threw the answer away.

**The fix is not to guess better.** Every value in the census after this point is read off
the page's own `<select>` options (`probes/dump-selects.mjs`) or off the type union in
source, and every setter's return value is read, so no arm can name a value the product
does not have and then measure the silence.

### 2 · The subject had no corners

```
Corners on/off, on a smooth sine wave      ->  0 px, both directions
Corners on/off, on a 99-point zigzag       ->  1,698 px, and the readout moves 506 -> 495 pts
```

`Smoothing` read 65 px on the same sine and 1,435 px on the zigzag. A control that
preserves sharp corners cannot be measured on a stroke that has none, and reporting the
first number would have called two working controls dead.

### 3 · The prerequisite was off

Every animation sub-control in the Texture, Dither and ASCII panels is `disabled` until
that family's Animation switch is on. Swept from the app default that is **39 arms reading
`0`** with `did: "DISABLED"` sitting in the same JSON row: 11 in Texture, 12 in Dither, 16
in ASCII (`data/sweep-Texture-STATIC.json`, `sweep-Dither-pre.json`, `sweep-ASCII-pre.json`).
Twelve more in Layers, behind the Stack Animation switch. The rows said so; a summary that
counted zeros would not have.

### 4 · There was nothing to animate

The twelve Stack Animation presets, driven through the pill's own router:

| base state | moved |
|---|---:|
| the app default | **0 of 12** |
| grain + Bayer 4x4 + Classic ASCII, layer stack on | **11 of 12**, 2,449 to 13,337 px |

A group animation over an empty group is a no-op, and the picture is right both times.
This one is also a real product note, and it is filed as one: nothing on that row tells you
the row above it is a prerequisite.

### 5 · The event had already happened

`evaluateStackAnimation` takes `sinceArmed`, and its own doc says why: *"`fadeIn` measured
from scene start is invisible."* So the probe waited 1.4 s after arming, and the fade had
been over for a second.

```
fadeIn, first grab 1.4 s after arming     ->  0
fadeIn, grabs from the instant of arming  ->  12,163  12,045  11,761  10,488  5,531  1,865  4
```

That is the control working perfectly, photographed after it finished.

### 6 · The control's job is to produce a zero

`freezeOnComplete` reads 0 on every arm, at both speeds, on a composed stack. It is doing
its job: it sets `frozen: reveal >= 1` and nothing else, so with nothing moving it holds a
still picture still.

```
layers animating, no stack behaviour        ->  3,306 px of motion over 3 s
the same, freezeOnComplete, playhead at 1   ->  0
the same, playhead scrubbed back to 0.5     ->  1,816
CONTROL, stack behaviour = drift            ->  3,259
```

**A control whose correct output is zero can only be measured against a subject that is
moving.** Nothing else can tell it from a dead one.

---

## And one that was mine

Seven `StyleState` fields came back as written by no control. Three of them survived a
second look and none survived a third. The sweep re-applied its base state between arms,
the panel re-rendered, and `document.querySelectorAll(...)[idx]` then pointed at a
different element: six Material arms and three Fusion arms drove the wrong node.

The tell was in the run's own output and I had put it there deliberately: `⚠ index drift`,
printed whenever the element at the recorded index was not the tag the row said it was.
Re-indexed fresh on every iteration, **71 of 71 fields are written by a control a user can
reach**, and `ditherAngle` turned out to be the `Screen angle 45°` slider, which appears
when the pattern is an angled one.

**A positional handle is a pointer, not a thing.** The `silent-degradation` skill's §5
question applies to a DOM index exactly as it does to a symlink or a gitlink: what in my
subject is a pointer rather than a thing, and does my tool follow it or count it? An index
into a live DOM is the most perishable pointer in this repo, because the thing it points at
is re-created on every React commit.

---

## The rule this leaves

The repo already says *validate the instrument before reporting what it says*. That is not
enough on its own, because all six instruments above were valid. Each had a noise floor of
0 and a positive control in the thousands, in the same run, and each was still wrong.

> **A floor and a positive control prove the instrument can SEE. They say nothing about
> whether it is LOOKING AT THE THING.**

So before a zero goes in a document, one more question, and it is cheap:

> **What would have to be true for this control to change a pixel right now?**

Name it, then check it is true. On this census that one question was worth six findings
that were not findings, and it is the difference between "0 of 165 controls are dead" and a
document naming seventeen live controls as corpses.

Its companion, from the other end, is the one F81 already paid for: **the pen tip's six
shapes really do draw one picture**, against a control of 8,761 and a floor of 0, in four
geometry modes on two routes. The question above is not a way to explain a zero away. It is
what you have to do before you are allowed to believe one.
