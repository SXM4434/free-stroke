# 47 — The question the instrument could not ask

Explainer 43 counted seven instruments whose SUBJECT differed from their CLAIM —
the tree, the checkout, the canvas, the invocation, the scoreboard, the pose and
the launch mode that cost Sebs his machine. The citation made eight. **This is
the ninth, and it is the most upstream of all of them**, because it is not about
an answer that was wrong.

> **It is about a question the instrument was never able to put.**

Eight of the nine measured *something*, and the something was not the thing the
output was about. This one measured nothing at all, printed nothing at all, and
was green — because the object it asked did not have the key, did not have the
method, or rewrote the answer before the next frame.

Three lanes hit this wall in one night from three directions, and none of the
three could see it was the same wall.

---

## 1. The three, and what they have in common

| lane | what it said | what was actually true |
|---|---|---|
| **Q** | *"row 3 is unfalsified — **no harness can set a mesh invisible**, so nothing available makes `visible` say otherwise."* | correct, and one level short: the reading is unfalsifi**able**, by construction, twice over (§2) |
| **W** | `_probe-drawin-holes.mjs`'s census read **two key names that do not exist**, so `list.length` — the number that attributes the whole joint-break arm — was never recorded | `pick` guards with `if (k in o)`, so nothing threw. The keys were simply absent from every `globals.json` that probe has ever written |
| **W** again | four teardowns restored `setPenTip("reed")` — **a named guess, not the recorded prior** — so arms 4–8 ran off-state | the harness pairs seventeen of its eighteen setters with a reader. Nothing could hand back the *whole* prior, so every file hand-rolled a partial one, one dial at a time |

Read as bugs they are three unrelated slips in three files. Read as one shape
they are the same sentence:

> **The harness was asked for something it does not have, and answered with
> silence.**

`o.count` on an object with no `count` is `undefined`, not an error.
`h.setAutoRotate?.()` on a harness with no `setAutoRotate` is `undefined`, not an
error. A `visible = false` written onto a mesh whose frame loop sets
`visible = true` every tick is *reverted*, not refused. Every one of those is a
well-formed nothing, in the shape of an answer.

---

## 2. Row 3 was not unfalsified. It was unfalsifiABLE — twice.

Explainer 24 §10.2 row 3 reads:

> mesh hidden / culled · reading · **AMBIGUOUS** — true, but `visible` has never
> been observed to read `false` on any object in the census. Nothing here can
> fail it.

Lane Q and Lane W both wrote the repair as `setMeshVisible` on `__inflateProbe`,
and Lane W wrote it out to be landed cold, with a three-row known-bad and a
refusal arm. It is a careful handover and it says the right thing:

> *"It MUST index through `collect()` — the same helper the census walks. A
> harness that used its own traversal would give `index` a different meaning in
> the setter than in the reading."*

**Landed verbatim it would not have closed the row**, and the reasons are both in
`components/viewport-3d.tsx` rather than in the design.

### 2.1 · The census cannot see an invisible mesh

`FusionProbe`'s `collect()` is:

```ts
scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return
  if (!o.visible || !o.geometry) return          // <- here
  …
})
```

`revealState()`'s per-mesh `ranges` walks that list, and one of the fields it
pushes is `visible: m.visible`, under a comment that names its own subject:
*"EVERYTHING ELSE THAT CAN MAKE A SUBMITTED MESH INVISIBLE."*

So the census's CLAIM is *everything that can make a mesh invisible* and its
SUBJECT is *the meshes that are visible*. The field is not merely unobserved
reading `false`. **It cannot read `false`.** Hide mesh 0 and it does not appear
in the census as `visible: false` — it disappears from the census, and the row
count silently drops by one.

That is explainer 43's instance 3 — an instrument resolving its subject by a
property its own action changes — living inside the reading that instance 6 was
supposed to fix.

### 2.2 · The frame loop rewrites it every frame

`useFrame` writes `mesh.visible = true` **unconditionally**, twice: once on the
inflate + `revealKeys` path and once for solid / extrude / inflate. Both lines
are inside the per-frame callback. An external `m.visible = false` survives until
the next tick and no further.

So the cold-landed setter would have returned `true`, the census would have
printed `visible: true` for every mesh, and the ink would not have fallen. **A
driver that reports success and changes nothing** — which is exactly the class
explainer 39 rule 1 exists for, reintroduced inside the fix for it.

### 2.3 · What actually landed

- **`collectAll()`** — `collect()` without the visibility test. `collect()` is
  left alone: seven members walk it and their subjects are right as they stand,
  and widening it would move seven answers to repair one.
- **`revealState()` walks `collectAll()`**, and prints `meshesVisible` beside
  `meshesAll` so the census says which list it took. On a shipped page they are
  equal; the day they are not, the reading that used to be silent about it is the
  one printing the difference.
- **`forcedHiddenMeshes`** — a module-scope latch keyed by `uuid`, which the
  frame loop now honours (`mesh.visible = !isForcedHidden(mesh)`). Identity is
  the uuid and not the index, because an index into a list whose membership the
  setter's own action changes is §2.1 all over again: hide mesh 0 and every later
  mesh renumbers, so the restore targets a different object.
- **`__inflateProbe.setMeshVisible(index, on)`** — validating, `false` on
  anything that is not an in-range integer, plus `forcedHidden()` so a sweep can
  assert it disarmed what it armed instead of assuming it did.

🔴 **AND THE ROW IS STILL NOT CLOSED, WHICH IS THE POINT OF SAYING SO.** Every
one of its three known-bad arms is a pixel arm and needs a render. No browser was
opened for this pass. The command that would falsify row 3 is

```
FS_PORT=<port> node scripts/verify/assert-drawin-attrs.mjs
```

…with those rows added to that gate, which is not this lane's file. **Row 3 stays
unfalsified until someone runs it.** What changed is that it is now falsifi*able*,
and it was not before.

---

## 3. The enumeration — what the surface actually is

Parsed off the app's own object literals with the TypeScript compiler API, never
copied into a list:

```
__captureHarness   components/viewport-3d.tsx   52 members
__inflateProbe     components/viewport-3d.tsx   12 members
…and 11 more published `window.__*` object literals across the app
                                               169 members in total
874 resolved references across 393 files under scripts/
```

### 3.1 · Five calls name a member that does not exist. One is deliberate.

| site | what it reads | what happens |
|---|---|---|
| `assert-view-presets.mjs:299` | `typeof h?.setAutoRotate === "function"` | **legitimate** — a deliberate probe FOR ABSENCE, and its row reports the answer. The one honest reason to name a member that is not there |
| `_probe-laned-halves.mjs:89` | `Array.isArray(j) ? { count: j.length, sample: j.slice(0,3) } : { count: null }` | 🔴 `__heroJunctions` is an **object**, never an array. The ternary has always taken the else branch: this probe has printed `count: null` on **every run it has ever made** |
| `verify-engine-ab.mjs:241` | `{ meshCount: d.meshCount?.(), buildCount: d.buildCount?.() }` | 🔴 `__geomDebug` has eleven members and `meshCount` is not one. Every A/B row this tool wrote carries `meshCount: undefined` beside a real `buildCount`. The member it wants is `stats()` |
| `verify-gloss-rim.mjs:299` | `const root = window.__geomDebug?.normalHistogram; return root ? root() : null` | 🔴 `normalHistogram` appears **nowhere in this repo**. `band` is `null` in every `probes[…]` payload this tool has ever written — and the comment three lines above says that band **is the bevel**: *"a die-cut rim scores 0."* The measurement was never taken and the evidence file has a field for it. The member that exists is `probeNormals()` |

`_probe-laned-halves.mjs` is Lane W's defect in a second file, losing the same
number — `list.length`, the one that attributes the joint-break arm. Nobody found
it in a week of reading these files, because there is nothing to see: the else
branch is well-formed and its output is well-formed.

### 3.2 · Ten members nothing has ever called

Two were there before this pass, and one of them is a whole API:

- **`__captureHarness.letterSeam`** — a dead wrapper. Its two would-be consumers,
  `assert-letter-seam.mjs:118` and `_probe-lane3-when.mjs:48`, both read
  `window.__letterSeam` **directly**. The wrapper was never the shorter path.
- **`__inflateProbe.meshCount`** — duplicated by `stats().meshCount`, which is
  what all three consumers call.
- **`__revealHarness.schedule`** — sixteen of that surface's seventeen members are
  driven from `scripts/`. This is the seventeenth.
- **`__engineHarness.setEngine` and `.get`** — 🔴 **an entire API nothing drives.**
  `app/desk-doodles/page.tsx` publishes it with the comment that switching the
  engine *"builds the word — which is the whole point of the comparison"*, and no
  file under `scripts/` names `__engineHarness` at all. `verify-engine-ab.mjs` —
  the A/B tool it was written for — clicks the page's pills instead.

DISPATCH §2.7 is *"a dial whose label does not describe what renders is a defect
— wire it or remove it."* These are that rule with an API in place of the dial,
and until now nothing in the repo could state them.

---

## 4. The teardown class, and why the fix belongs in the harness

Lane W found four teardowns restoring `setPenTip("reed")` and fixed them by
reading the live value first. That is the right fix for four files and the wrong
fix for the class.

Measured on this tree by parsing, with the setter/reader pairing **derived** from
the harness rather than written down:

```
18  `set*` members on __captureHarness
17  of them have a paired reader whose name is derivable from theirs
17  files under scripts/verify/ drive a paired dial to a hardcoded literal
 6  of those never call that dial's own reader at all
```

The discipline is not missing — eleven of the seventeen **do** read a getter. It
is hand-rolled once per file, one dial at a time, so it is complete nowhere. And
telling sixteen files to restore the right literal is sixteen more chances to get
it wrong, expiring the day a default moves.

So: **`__captureHarness.snapshot()` and `.restore(snap)`** — every dial this
harness owns, in one round trip, put back by the same object that handed it over.
A validating driver: `false` if the argument is not a v1 snapshot or if any
single channel refused, because a teardown that half-applied would leave the
sweep off-state while reporting success, which is the same silence `"reed"` had.

Two things worth saying plainly about it:

- **`setFlatten` had no reader, and it is the most-driven member of the whole
  harness.** Seventeen of eighteen setters pair with one; this was the exception,
  so nothing could ask the page what the flat override *is* — only what it had
  just been told. `snapshot()` would have had a hole in it exactly where the hole
  does most damage. `flatten()` lands with it.
- **The camera and the playhead are NOT in the snapshot, and it says so.**
  `orbitView` / `focusView` write a pose nothing on this object can read back, and
  the playhead belongs to the page. A snapshot that quietly claimed to cover them
  would be this file's own subject one level up — explainer 39's fourth axis is
  *"a dial the harness does not own"*, and those are two of them.

> Telling sixteen files to restore the right literal is sixteen chances to get it
> wrong again. Giving the harness a `snapshot()` makes the right thing the easy
> thing.

---

## 5. The gate — `scripts/verify/assert-harness-surface.mjs`

**7 rows, ALL PASS, exit 0.** Classified **MODEL** by Lane K's AST classifier
(`{"list":"model","why":"no driver import, no launch call, no browser child"}`);
partition intact at **98 = 45 MODEL + 53 BROWSER, overlap 0**.

| ch | asks |
|---|---|
| **A** | the surface is DERIVED from the app's own object literals, never copied — and a scan that resolved *nothing* FAILS, so an empty subject cannot read green |
| **B** | every harness member a script calls actually EXISTS — hard fail, ALLOW list |
| **C** | every member of an API surface gets called by something — ratcheted on a data file, ALLOW list |
| **D** | every KEY a census asks for exists on the object it names — Lane W's defect, hard fail |
| **E** | every ALLOW entry carries a written reason AND still needs the exemption — Lane F's channel E, copied |
| **F** | CALIBRATED both directions on the bare invocation — 9/9 fixtures, written to a temp dir |

### 5.1 · Parse, do not grep

Lane K proved a grep cannot tell code from prose *inside the machine that decides
which battery runs a file*. This gate would fail its own grep on §3.1 above,
which names `__captureHarness.setAutoRotate` and `__geomDebug.normalHistogram`
without calling anything. Every question is asked of the syntax tree.

**The one place that is not enough is stated rather than hidden.** A call can be
written as a string — `evalJS("window.__captureHarness.grab()")` in
`scripts/capture/capture-frames.mjs` is real and is invisible to an AST walk of
the calling file. So a string containing a surface name is **re-parsed as
JavaScript**: a clean parse makes it a call site, and parse errors make it prose,
which is **printed** under "text mentions" rather than silently dropped.
`assert-hero-dials.mjs:79`'s `az: "page.tsx __captureHarness.orbitView"` is a
data-table label and produces one parse diagnostic; that is how it is told apart
from the real thing. Sixteen such mentions are listed on every `--list`, and the
residual risk runs one way only — a prose string that happens to parse can make a
member look USED, never make a real call look MISSING.

### 5.2 · Why channel C is not asked of every surface

Thirteen `window.__*` object literals are published. Grading *"every member gets
called"* across all of them puts **61 non-defects** on the gate's first run:
`__heroPenField` publishes thirty numbers precisely so whichever one a future
defect needs is already there, and an unread key is that payload doing its job.
A gate that is red on arrival for sixty-one non-reasons is a gate somebody
switches off in week one.

So the line is **derived, not listed**: a surface is an API when every member
whose kind is known is a function. `__captureHarness`, `__inflateProbe`,
`__geomDebug`, `__revealHarness` and `__engineHarness` are APIs; `__heroPenField`,
`__letterSeam`, `__heroJunctions` and the rest are payloads. A new surface joins
the right side of the line the day it lands, and neither side is a name in the
gate.

Channels B and D stay repo-wide, because a key that reads `undefined` is a defect
on a payload exactly as much as on an API — which is the whole of §1.

### 5.3 · The exemption list is the part that gets skipped

Fifteen entries, each with a written reason and what retires it, **printed on
every run**. Five are channel B; ten are channel C. Four of the B entries are the
real defects in §3.1, exempted by OWNERSHIP because every one is a file Lane V
holds tonight — each names the wrong member, the right member, and the line.
Five of the C entries are the members this pass landed, each naming the consumer
that is not written yet and why (it needs a browser).

A stale entry is itself a FAILURE. That is how an exemption list kills the gate
that owns it: the file gets fixed, the entry stays, and the next violation in
that file is excused by an argument nobody made about it.

### 5.4 · Mutation-proved, both directions

Three end-to-end mutants beyond the nine fixtures, each reverted **byte-identically**
(sha256 checked):

```
harness member `grab` REMOVED           -> B RED, 57 unexplained sites   exit 1
a member nothing calls, ADDED           -> C RED, 1 against baseline 0   exit 1
a STALE ALLOW entry, PLANTED            -> E RED                          exit 1
--record with the ratchet RAISED        -> REFUSED, nothing written
the baseline file REMOVED               -> C RED, "a missing baseline is a failure, not a default"
```

And the clean pair does **not** flag: 7/7 PASS, exit 0, on a tree byte-identical
to canonical on all ten files checked.

### 5.5 · The ratchet has no headroom

`harness-surface-baseline.json` sits beside the gate — Lane O's mechanism, copied
rather than reinvented, for its stated reason: *"a ratchet only its author can
lower is a debt counter, not a gate."* `--record` refuses to raise it.

The baseline is **0**, not 10, because every explained dead member is excluded
from the ratcheted count. Headroom is free violations (explainer 37 §4); a
baseline of 10 would make the next ten dead members cost nothing.

---

## 6. The shape of it

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 35 asked it of the evidence. Explainer 39 asked it of the arm.
Explainer 43 said they are all one question and gave it a cheap form: **name the
subject in the output, beside the number.**

This one is the same question moved one step earlier, before there is a number at
all:

> **Can the instrument put the question at all — and if it cannot, does anything
> say so?**

Nothing did. `count` on an object with no `count`, `setAutoRotate` on a harness
with no `setAutoRotate`, `normalHistogram` on a `__geomDebug` that has never had
one, `visible` on a census that filters out the invisible, a teardown restoring a
value it never asked for. Five silences, five well-formed nothings, and every one
of them was published beside a number that a reader took to mean something.

The instrument was not wrong. **It was never able to be wrong**, which is the
same thing as never being able to be right.
