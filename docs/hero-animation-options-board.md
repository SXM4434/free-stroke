# The Hero Animation — Options Board

*The camera re-decided from logic, the answer to "how do you show it is 3D," and
the option set — his four boarded properly, plus four of ours, plus the weak
bucket. Written the way `docs/hero-beat-storyboard.md` and
`docs/2d-register-board.md` were written, against the same sources
(`docs/research/storyboarding.md`), and against both films watched frame by
frame.*

> **PHASE 1. NOTHING IS BUILT.** This pass wrote this file and the evidence
> frames under `docs/verification/animation-options/` and nothing else. `lib/`,
> `components/`, `app/`, `scripts/`, `docs/hero-beat-storyboard.md`,
> `docs/2d-register-board.md` and `SESSION-HANDOFF.md` were READ, never written —
> other lanes are live in them. No commits. This is a board for Sebs to react
> to, and no build fires off it until he has (`docs/DISPATCH.md` §0).

**The calibration this is designed against, verbatim:**

> *"THE CAMERA ANGLES CHANGE ARE ABRUPT AND DONT HAVE ANY EASING AND STILL DONT
> MAKE REAL SENSE… I THINK I UNDERSTAND IT'S TO SHOW THAT IT'S 3D BUT IT'S GOD
> AWFUL"* · *"U NEED TO ACTUALLY THINK THROUGH HOW TO SHOW ITS 3D"* · *"THE 2D
> AND 3D TRANSFORMATION IS WAY TOO SUBTLE"* · *"UR STILL NOT DOING STORYBOARD
> RIGHT CAUSE THESE CAMERA ANGLES WOULD HAVE BEEN CUT JUST FROM LOGIC ALONE"*

**And the short answer, before the evidence: he is right, and the record proves
it.** The camera poses — `lieEl: 65`, `standupAz: 30`, `holdAz: 38`
(`lib/hero-motion.ts:885-889`) — were never derived from a shot brief. No
document in this repo derives them from anything; the storyboard's §3 quotes
them as given, and every pass since (§10.3's re-cut, §11.7.8's seam fixes,
§11.9.1's release) tuned their *timing* and never asked whether the *shots*
should exist. Run the board's own admission test against them — *"a held
drawing… works when framed and hung on the wall"* — and three of the beat's
shots cannot say what they tell. §2 cuts them, from logic, before anything is
built. §3 answers the question nobody answered. §4 is the option set.

---

## 0. Read-proof ledger

Every doc the dispatch names, ✅ + a specific citation proving the read.

| doc | ✅ | citation |
|---|---|---|
| `~/…/portfolio-system-lab/docs/system/FABLE-GHOST-BRIEF-ENGINE.md` | ✅ | §0, the two phases both gated: *"**Phase 1 — IDEA CREATION (the map):** produce the 6-category / per-option map through the full pre-flight + online research + saved refs. → goes to Sebs (§2.11) → he gates."* And §4.9, the rule this board's weak bucket runs on: *"Weak goes to the weak bucket, not into the 36. Padding the count with filler is the median — the exact AI smell this system exists to kill."* |
| `…/AGENT-DISPATCH-CONTRACT.md` §0.5 · §0.6 · §0.7 · §1 | ✅ | §0.5.1c on reference video: *"Study **AS MANY FRAMES AS POSSIBLE** — build a DENSE contact sheet… NEVER judge from 2–3 frames or a thumbnail"* — the sheets in `docs/verification/animation-options/` are that, for both films. §0.6: *"ZOOM IN before you return… is every line, every secondary motion, every edge actually finished and crisp?"* §0.7: *"REWORKING/IMPROVING a read IN PLACE is STILL a deletion"* — why §2's cuts are dial-parked arms, never deletions. §1: *"a fabricated quote, or a missing citation on an applicable doc = the read didn't happen."* |
| `docs/DISPATCH.md` | ✅ | §0: *"The hero-beat storyboard is a Phase 1 deliverable. It is a plan for Sebs to react to, and no build fires off it until he has."* §2.2: *"A citation is not evidence — it is a claim that evidence exists. Every mechanism claim names what you saw, in which frames."* |
| `docs/hero-beat-storyboard.md` — IN FULL, §10 and §11 first | ✅ | §11.9.2 on the Overshoot dial: *"a slider whose 400 positions are two states is a names-match-behaviour failure… the name is right and the affordance is the lie."* §11.7.6's third row, the number this whole board turns on: *"DEAD-ON THE POOL IS INVISIBLE — reported, not asserted away… a contact pool is a horizontal plane, so at the beat's parked elevation it is edge-on and worth nothing."* §10.2 C7: *"K4's 18 frames is the payoff of the absence. Do not spend it."* §11.9.6: the one open gate, `max cy step 2.00 px` against a ceiling of 2. §7's three numbers a rebuild must not lose, and §11.7.1's *"The property is affineness. It is portable; it just had to be bought from the camera."* |
| `docs/2d-register-board.md` | ✅ | §2.3, watched not argued: *"Where junctions cluster — the `esk` overlap — the openings collapse into a scatter of white squares… what the eye reads is not pen order, it is damage."* §4 F5's property 4: *"It is ONE junction, not twenty-two… I watched 22 at once read as damage."* §8: *"Each register gets one thing to say; the 3D register's is thickness; the 2D register's is order."* |
| `docs/research/reference-film-mechanics.md` | ✅ | §4.2: *"The frame is emptied for 625 ms (15 frames) before the payoff arrives… a measured frame-to-frame change of exactly 0.000."* §6.3: *"**292 ms and 433–467 ms are the two transition lengths these films use.** There is nothing between 200 ms and 290 ms, and nothing above 500 ms."* §6.5: arrival 9–37 % / wind-up 79–93 %, *"Nothing that has a silhouette is spaced evenly."* §8: *"one band lights and the other two sit at mad < 0.15, a **100:1 separation**"*; Babbu cascade simultaneity 1. §9: *"An accent is bought with a hold, not with a move"* — 4292 ms and 2586 ms before the two biggest. §5.2: *"Elements arrive at 417–500 ms apart and **leave four times faster than they arrived, all at once**."* §4.5: EC's payoff unit, 1.6 s of 4.5 s parked = the 36 % bar (C8). |
| `docs/research/online-reference-mechanics.md` | ✅ | §6.1: *"**Nine of eleven park the camera**… The three purpose-built extrude templates all rotate the **object** and hold the camera."* §6.2: *"The form itself is white paper against white paper… What makes it read as standing is entirely the shadow"* (paper-street f95–f110) and the transfer-#3 law: *"a cast shadow, an occlusion, or a shaded interior face must arrive with the form."* §3.1: mechanism 45–55 % / material 20–30 % or one frame — *"A mechanism does not ease; a graphic does"* — and the correction that our 42 % *"is not the fault… The fault is that our beat is spaced like a mechanism while being staged like a graphic."* §5: payoff hold 1.7–3.3 s. §4: the one-frame substitution, f63→f64 at hcorr 0.996, *"because the outline's outer contour IS the solid's silhouette."* §7.1: the white blow-out *"we cannot have it."* |
| `docs/research/storyboarding.md` | ✅ | Whitaker/Halas/Sito p. 54, the admission test: *"A held drawing can usually be extracted from the animation and works when framed and hung on the wall."* The dolly-zoom section: *"with nothing to be parallaxed against, a dolly is indistinguishable from a zoom"* — the citation for cutting any push. §4's jump cut: *"a device of disorientation"*, and the 30-degree rule. Twos rule 2: *"It is dangerous to animate on double frames during a table move… or camera track."* |

**Watched, frame by frame, with my own eyes** (sheets saved to
`docs/verification/animation-options/`, timestamps in the filenames):

- **`docs/verification/hero-beat-film/shipped/film.mp4`** — the shipped beat,
  1321 painted frames / 344 encoded, whole film at 4 fps + the turn, the
  tilt+standup and the orbit→return at native rate, + five full-res stills.
  What I saw is §1.
- **`docs/verification/hero-beat-recordings/1-OG-eased-flip.mp4`** — the
  original, whole film at 5 fps + the flip at native 25 fps. The OG is: draw →
  hold → one turn through the edge → hold, on an **empty ochre field**, camera
  parked for all 9.2 s. Its turn narrows over ~5 tiles, slivers, returns — and
  both its faces read as the same silhouette. One event, two holds, zero camera.

**Run first-hand on this machine:** `ffprobe` on both films (344 fr / 25 fps /
1120×840 · 230 fr / 25 fps / 960×540); `shipped/REPORT.txt` read (12 phases,
0.900× real time, 0 console errors); `lib/hero-motion.ts:885-889` opened and the
three inherited poses confirmed live (`lieEl: 65, standupAz: 30, holdAz: 38`).
Nothing else was run; every other number cites the doc it comes from.

---

## 1. What I saw in the film — three shots that tell nothing

Not an opinion about feel. Each row is a thing visible in the saved frames, with
the measurement that already existed for it.

**1.1 · The head-on solid is the drawing.** `01-headon-flat-LEFT-vs-solid-RIGHT.png`:
the flat mark at t 5.2 and the "solid" at t 7.55, side by side, are the same
picture — the only difference is ink a shade warmer, and you need the A/B to see
even that. The repo already knew: the flat state's medial-axis half-width is
**identical to the solid's to three decimals** (`viewport-3d.tsx` doc comment,
7.07 px / 0.493 both), and the last lane's own verdict on `solid` is that it
*"is visually indistinguishable from the drawing"* for 0.90 s. **K4 — the shot
whose stated job is the A/B against K1 — carries no news a viewer can see.**
Its supposed news, the contact shadow, measures **exactly 0.00** at arrival,
because it lands at el 0 where a horizontal pool is edge-on
(storyboard §11.7.6: *"DEAD-ON THE POOL IS INVISIBLE"*).

**1.2 · The "3D story" is acted by the camera, and it reads that way.**
`02-the-camera-performs-*.png` and `05-current-tilt-standup-*.png`: between
t 7.85 and t 11.05 the mark **never moves** — `tilt`, `standup`, `orbit`,
`descend` are all az/el/fill channels. The word compresses to an illegible band
(the lieEl 65 look-down), re-expands with a lean, holds the lean, and
un-leans. At contact-sheet scale — which is honest about what a first-time
viewer reads — the whole passage is *the word squashing, skewing, and
un-skewing*, with a soft grey wisp of shadow that appears mid-transit and is
gone by the hold. The film says "the drawing stands up"; the implementation
moves the **viewer**. A viewer parses a camera move as *I moved*, not *it
moved* — which is exactly *"I get the idea but it's not working."*

**1.3 · The money frame's whole case is a lean plus tube shading.**
`09-money-frame-hold34-t10.0.png`: at az 38 / el 10 the silhouette is the flat
word gently skewed. The dimensional read at full res comes from the rounded
tube shading — real, and paid for — but there is **no cast shadow** (at el 10
the pool is still nearly edge-on: sin 10° = 0.17 of it), **no occlusion
change**, and **no parallax** (orthographic camera, by design, §11.7.1). Of the
three things the reference set says must arrive with a form — *a cast shadow,
an occlusion, or a shaded interior face* (`online-reference-mechanics.md` §6.2)
— the hold has one, at whisper level. That is *"way too subtle"* measured.

**1.4 · The moment competes with a ruled grid.** The OG stages its beat on an
empty warm field (`07-og-eased-flip-overview-5fps.png` — nothing on screen but
the mark, ever). Ours runs on full-frame ruled graph paper
(`03-current-film-overview-4fps.png`), so the one frame that matters — a 24 px
sliver — shares the screen with forty printed lines, and the grid is also the
most visible witness of every camera wobble. The 2D board's F1 wants a ruling
*to make the page a page*; it does not want the ruling to be the loudest thing
in the payoff.

**What survives untouched:** the draw-in (4.667 s at the 100 ms hand floor —
correct, keep), the breath, the wind-up release (§11.9.1), the turn itself —
`04-current-turn-native-25fps` shows it narrowing, slivering for two frames,
and returning, and it reads as an *event* even at 280 px tiles. The turn is the
one built thing the eye confirms. The problem is everything staged around it.

---

## 2. The camera, re-decided from logic

The method, applied for real this time: every shot answers *what does it TELL?*
A shot that cannot answer is cut **here**, before anything is built. §0.7
discipline: "cut" means the phase's arm is parked behind its existing dial
(`cameraPark`, `tiltLaw`, `descendLaw`, `ret.mode` all exist), never deleted.

| shot / phase | what it claims to tell | verdict, from logic |
|---|---|---|
| draw | "a hand wrote this, at hand speed" | **KEEP.** The one passage nothing else can be. |
| breath (K1 hold) | "this is the drawing at rest; remember this framing" | **KEEP.** |
| anticipation | "something is about to happen" | **KEEP** — it renders now (−4.57 %), and it is the only warning the moment gets. |
| emerge (the turn) | "the mark has thickness — here is its edge" | **KEEP.** Built, 8/8, and the only instant in the film with a before and after. |
| land | "the turn arrives" | **KEEP** (it is the turn's own settle). |
| `solid` (K4) | "compare this to K1 — see the difference" | **CUT AS TOLD.** There is no visible difference to compare (§1.1). The shot survives only if it is given news a viewer can see — an occlusion or a shadow that exists at this viewpoint. A held frame of an invisible difference is dead air with a name. |
| `tilt` (dive to lieEl 65) | nothing — it exists to reposition the camera so `standup` can start from "lying down" | **CUT.** This is the shot that would have been cut from logic alone. It takes the word through 0.43 s of illegibility to retcon the page from a wall into a floor mid-film. The film opens dead-on at el 0 — the page reads as a sheet in front of you — then one camera lurch declares it was a tabletop all along. **The geometry of the scene must never be re-litigated mid-beat.** Establish gravity in frame 0, or never. |
| `standup` (the rise) | "the drawing stands up off the page" | **THE CLAIM IS RIGHT AND THE ACTOR IS WRONG.** As shipped, the *camera* rises; the drawing never moves. Rebuild it as the object's move (§3, and options O2/O5) or drop the stature claim and keep thickness (O1). A camera cannot perform the product's verb for it. |
| `orbit` (the ¾ hold) | "here is the standing form — look at it" | **KEEP THE HOLD, RE-EARN THE POSE.** A payoff hold is non-negotiable (1.7–3.3 s genre band). But the pose must be one the *object* reached and one where its dimension shows. A camera-granted lean of 10–15° shows almost nothing (§1.3). |
| `descend` + `returnTurn` + `hold` (K7) | "the round trip closes; your drawing comes back, changed at the crossings" | **KEEP K7's news; CUT `descend` as a camera move.** If the camera never left (see below), there is nothing to descend from. The return turn and the joint-break reveal survive whole — they are the object's. |

**The standing law that falls out, and it is the reference set's own:**

> **The camera watches. The mark performs.** Nine of eleven online clips park
> the camera, including all three purpose-built extrude templates, which rotate
> the OBJECT (`online-reference-mechanics.md` §6.1). The original set has 0 px
> of camera drift in 114 s. Our own OG never moves it. Nothing in 13 measured
> films performs a dimensional reveal with a camera move — and we tried to
> perform ours with four.

**The legal cameras, all three parked.** Any option below uses exactly one:

- **C-A · DEAD-ON, parked, forever.** The page is a sheet facing you. Depth is
  *toward the viewer*; the shadow that exists at this viewpoint is a page-plane
  drop shadow behind the form (offset by the rake), never the floor pool
  (which is invisible here — 0.00, measured). Head-on identity is exact.
- **C-B · DESK ¾, parked, forever, from frame 0.** az ≈ 20°, el ≈ 30° — a
  person looking at their own notebook. Gravity is established before the first
  stroke; the draw happens obliquely on a desk (which is where desk doodles
  live); the floor shadow, the interior faces and the silhouette change are all
  visible from the one chair. Cost: the dead-on "exactly your drawing" frame
  never exists.
- **C-C · DEAD-ON, one authored CUT to DESK ¾.** The reference grammar allows
  it: cuts are preceded by a hold and land on stillness (`reference-film-
  mechanics.md` §2.2 — nine of eighteen cuts preceded by ≥ 250 ms; the reveal
  cut leaves a 4.29 s frozen frame), and the two framings must sit ≥ 30° apart
  (the 30-degree rule) or the cut is a jump. One cut, both ends held, never a
  glide between them.

**Cut with them, permanently:** any el/az transit during the beat · the lieEl 65
dive · `driftEase` (already dead) · any push-in/fill move — a push on a lone
object in an empty frame is a zoom, and *"with nothing to be parallaxed
against, a dolly is indistinguishable from a zoom"* (`storyboarding.md` §4). It
communicates nothing and spends stillness doing it.

---

## 3. How do you show it is 3D? — from the form, not the camera

The measured answer exists and nobody had assembled it. The reference set names
exactly three devices that make a flat thing read as dimensional
(`online-reference-mechanics.md` §6.2, transfer #3): **a cast shadow, an
occlusion, or a shaded interior face** — *"Nothing in this set makes a flat mark
read as dimensional by changing the mark. They change what is around it."* Our
form can do all three, plus two only a real solid has. Ranked by how loudly each
reads, with what it costs:

1. **The silhouette does what a flat mark cannot.** The edge-on sliver (built —
   24 px of real thickness, depth 1.0000) and any true rotation of the form:
   a flat card's silhouette under yaw only *narrows*; a solid's grows side
   walls and changes outline shape. This is the one argument that needs no
   light and no ground. **Cost: already paid.** The turn is 8/8.
2. **A cast shadow that ARRIVES and MOVES with the form.** paper-street, frame
   by frame: f95–f97 flat sheet, *no shadow at all*; f98 a thin dark line under
   the lifting edge; f104 a dark mass — *"What makes it read as standing is
   entirely the shadow."* The shadow must be **bound to the form's motion**
   (grows as it rises, shrinks as it lies), and it must exist at the chosen
   viewpoint: floor pool at C-B; offset page-shadow at C-A. **Cost: a real
   projected shadow on the page plane for C-A does not exist yet — flag.**
3. **Occlusion — one stroke passing behind another.** Unarguable, because paper
   showing through a break is a depth ORDER, not a shading. Built for K7
   (8/8 on pixels: 1544 px ink→paper, 0 px paper→ink, surviving ink worst
   delta 0.00). The 2D board's law binds: **one junction taught first, never
   twenty-two at once** — 22 at once was watched reading as damage.
4. **The shaded interior face.** The tube's underside falls into shade as the
   form leaves the page (cartoon-network-popup: the rooms read dimensional
   because *"the interior walls fall into shade the instant the card opens"*).
   Ours already has the raked light; the cue costs nothing where the form
   actually rotates.
5. **Parallax between near and far strokes.** Only exists if the OBJECT
   rotates at a viewpoint off its plane (C-B): near letters traverse faster
   than far ones. Weak at our shallow depths; a bonus, never the case.

**And the one-line law for every option below:** the form performs one of these
five, one at a time, bracketed by holds — *an accent is bought with a hold, not
with a move* (4292 / 2586 ms before the reference set's two biggest accents) —
and the camera never helps.

The grid obeys the same logic: the ruling exists to make the page a page
(2D board F1), not to referee the payoff. Every option below assumes the ruling
drops to a whisper (≈ 3–4× fainter) or lives only near the baseline; the empty
field at the moment is the OG's own staging and it is the correct default.
Sebs's call on the exact weight — flagged in §6.

---

## 4. The option set

Each option: the ONE thing it tells · the camera it binds to · key shots ·
breakdowns with passing positions · the exposure budget · where it breaks,
frame by frame. Durations in frames are at 30 fps; every parked passage is on
twos (C6, and `online` §9.2's byte-identical-dwell argument). All budgets keep
the draw at **140 fr / 4.667 s** — the 100 ms hand floor is not available to
trade — and all clear C8's 36 % payoff-unit stillness bar unless said
otherwise. **These are budgets, not measurements. Nothing here has been
rendered.**

Shared vocabulary: `wind-up` = breakdown at 85–93 % of the transit; `arrival` =
9–37 %; transitions sit on the set's own two lengths, **292 ms or 433–467 ms**,
nothing between.

---

### O1 · THE TURN THAT LANDS — *the minimum re-cut of what is built*

**Tells: "your drawing has a body — watch it turn and show you its side."**
Camera **C-A** (dead-on, parked, forever). The ¾ pose is reached by the
**object's own turn landing short of home**: the built turn runs flat → edge
(state flips at 90°) → but instead of completing to head-on solid, it lands at
**yaw 38° short of head-on** — `holdAz: 38` survives as an *object pose*, not a
camera pose. Four camera phases (`tilt`, `standup`, `orbit`-as-camera,
`descend`) cease to exist; their seconds go to holds.

- **Key shots:** K1 flat held (33 fr) → K2 tense (9 fr, releases into the turn,
  §11.9.1 kept verbatim) → **K3 the edge** (13 fr out, wind-up 87 %, 2 fr dwell
  on twos) → **K3b THE LAND AT ¾** — the solid arrives already showing side
  walls and foreshortening, 13 fr, arrival-spaced (the mirror of B1: half-width
  passed at 13 % — the cushion sits on the far side) → shadow lands **on its own
  beat**, 6–8 fr later, easeOutStrong — at C-A this is the *page* shadow
  sliding out behind the form, down-light of it → **K6 THE HOLD**, dead still,
  **60 fr / 2.0 s** (genre band 1.7–3.3 s) → **K7 the return turn** (13+2+13,
  breaks revealed at the edge, exactly as built) → flat + the news, held 33 fr.
- **Breakdowns:** turn-out 87 % (B1, four confirmations); land 13 %; shadow
  arrival 10–20 %; return turn symmetric to the out-turn.
- **Budget:** 140 + 33 + 9 + 15 + 13 + 8 + 60 + 28 + 33 ≈ **339 fr / 11.3 s.**
  Payoff-unit stillness (breath onward): 126 of 199 ≈ **63 %** still. Clears.
- **Where it breaks, frame by frame:**
  - *The land pose.* If the settle into yaw 38 is under-cushioned it reads as
    "the turn got stuck." The land needs the EC arrival grammar — arrive at
    ~86 % of the pose and close the rest ease-out, τ ≈ 200 ms — and the frames
    to watch are the first 4 after the dwell.
  - *The shadow at C-A.* A page-plane drop shadow behind the form does not
    exist in the engine (the pool is floor-projected). Until it does, the land's
    second piece of news has no channel — the option ships with silhouette +
    interior shade only, and the shadow beat is cut rather than faked. Flagged
    as the option's one build item.
  - *The stature claim is not made.* Nothing stands up off any page. If Sebs
    wants the product's literal sentence performed, this is the wrong option —
    that is O2's job. This one buys the most read for the least motion.
- **Why it is on the board:** it is the shipped beat minus everything §2 cut,
  and the only option whose every mechanism is already gated 8/8. The cheapest
  path from "god awful" to sound.

---

### O2 · THE POP-UP — *the drawing stands up off the page, actually*

**Tells: "the drawing stands up off the page."** The product's own sentence
(VIDEO-DIRECTION §2.4), performed by the drawing. Camera **C-B** (desk ¾,
parked, from frame 0 — gravity is never retconned because it is established
before the first stroke). The word pivots up about its baseline like a pop-up
book panel — the hinge the online set says is the honest mechanism (five clips),
given the pivot edge the letterform genuinely has: **its baseline on the ruled
page.**

- **Key shots:** F0 the page at desk angle, ruling faint (10 fr) → draw,
  oblique, at hand speed (140 fr) → flat held (33 fr) → **the press** — the
  squash pinned at the contact, which at this viewpoint visibly flattens
  *against the ground* (9 fr) → **THE STAND** — the word pivots up about its
  base, **15 fr / 500 ms**, spaced like paper-street's cut-out (FH 67 %,
  back-loaded: it leans up slowly and commits late); the cast shadow appears at
  the baseline the frame the ink leaves the page and grows with it —
  paper-street f96→f107 verbatim; the undersides fall into shade → **THE HOLD
  standing**, dead still, **66 fr / 2.2 s** — the money frame: stature,
  thickness, shadow, all at once, all the object's → **the lie-back** — 13 fr,
  arrival-spaced, the shadow shrinking with it as one bound pair → flat + joint
  breaks open at the landing (K7's news, one junction first if the cascade
  grammar is wanted) → held 30 fr.
- **Breakdowns:** press = easeOutStrong reached-fast-held (B3); stand at
  ~67 % (paper-street's own number — the only measured flat-thing-stands-up in
  either corpus); lie-back at 20–30 %.
- **Budget:** 10 + 140 + 33 + 9 + 3 + 15 + 66 + 13 + 30 ≈ **319 fr / 10.6 s.**
- **Where it breaks, frame by frame:**
  - *The hinge line vs the descenders.* The baseline is ragged handwriting; a
    strict hinge slices the k/D descender ink, which would rotate "underground."
    The pivot must sit at the ink's bottom extent (or the base plane at the
    word's lowest run), and the frames to watch are the first 5 of the stand on
    the descender letters. This is the option's one real geometry question.
  - *The oblique draw.* The dead-on "exactly your drawing" frame never exists
    in this film. The drawing is always seen at the desk angle — an affine of
    the linework, never a substitute for it, but the head-on identity claim is
    surrendered. Named as the option's price; it is Sebs's brand call (§6).
  - *The stand's evenness.* A hinge reads mechanism; mechanism spacing is
    45–55 % — but paper-street measures 67 % and is the closer analogue (a
    made thing standing, not a machine cycling). If the 67 % read feels
    "performed," 50 % is the reference-legal fallback; the difference is 3
    frames of commit.
- **Why it is on the board:** it is the only option that performs the product's
  verb, and every one of its cues is the measured kind: hinge (5 clips), shadow
  arrival (f96→f107), interior shade (CN-popup), payoff hold (1.7–3.3 s).

---

### O3 · DRAWN IN BOTH — *his idea #1: the ink is solid off the nib*

**Tells: "drawing and object are one act of the hand."** The draw-in IS the
transformation: as the pen writes, the ink it leaves becomes solid — so the 2D
register and the 3D register are both drawn in, in one pass, by one hand.
Camera **C-B** (the tube-ness must be visible *during* the draw; dead-on it
reads only as shading).

Two shapes, and the second is the stronger:

- **O3a · the wake.** A transformation front trails the pen by ≈ 400–450 ms
  (Babbu's object→label interval — the follower reads as caused by the leader).
  Ink swells into tube continuously behind the nib. Risk: two moving loci — the
  simultaneity-1 rule bends only if the front reads as the pen's *wake*, one
  causal gesture. Unreferenced in either corpus; carried as ours.
- **O3b · pen-up pops. RECOMMENDED SHAPE.** Each stroke inflates **the frame its
  pen-lift lands** — a one-frame substitution per stroke (the genre's own answer
  to the seam: f63→f64 at hcorr 0.996, legitimate because the outline IS the
  solid's silhouette — ours is, by construction). Twenty-two pops **at the
  hand's own recorded intervals** — the cascade rhythm is not designed, it is
  the handwriting's, which no reference film can compete with. Simultaneity
  stays exactly 1 (the pen is between strokes when each pop fires).
- **Key shots (O3b):** page → draw begins; stroke 1 pops solid at its pen-up
  (the audience learns the rule on the first stroke — teach then spend) → the
  word assembles as ink-becoming-object at hand cadence, 140 fr → last stroke
  pops = **the completion accent** (~44 % placement, before:after ≈ 1:1.3 —
  inside the EC/Babbu band) → the shadow deepens once, on its own beat, as the
  whole word is done → **THE HOLD**, 75 fr / 2.5 s → optional: whole-word
  return turn + breaks (K7 kept) or end standing.
- **Where it breaks, frame by frame:**
  - *The first pop.* If stroke 1's pop reads as a glitch (no warning, no
    ceremony), the whole grammar is lost — the first pen-up may need a 2-frame
    dwell + the shadow's first appearance to mark it as an event. Watch frames
    1–6 after pen-up #1.
  - *Pop visibility at C-B during motion.* A substitution mid-draw competes
    with the moving pen for the eye. The pen is the faster mover; the pop is a
    value/shading step on a *parked* stroke — the 100:1 separation rule is
    satisfiable but must be verified per stroke on film.
  - *No single moment.* The beat's drama is distributed across 22 small events;
    there is no one instant to point at. For a *hero* beat that may be exactly
    wrong — or exactly the point ("the hand is the event"). Named as the
    option's identity, not smoothed over.
- **Why it is on the board:** he asked for it, and the strong shape is
  reference-native (one-frame substitutions, hand-cadence cascade) while being
  the only option where the transformation is literally authored by the pen.

---

### O4 · SOLID FIRST — *his idea #2: the object confesses it is a doodle*

**Tells: "this object was your drawing all along."** The arc runs backwards —
open on the dimensional thing, end on the hand's flat ink. The identity claim
(*your hand survives*) is made in the direction a portfolio actually argues:
here is the product; look closer, it is handmade.

- **Camera C-A** (dead-on hold framing bought at the end must be exact; the
  affine camera guarantees it).
- **Key shots:** open: 2 frames of empty page, then **the solid pops in already
  dimensional at the ¾ object-yaw**, 86 % scale, settles ease-out (all4-idents'
  own open — *"the set never shows the flat, one-value state of the thing it is
  about to make dimensional. It cuts away and comes back"* — run in reverse
  order of ours) → **HOLD standing**, 45 fr / 1.5 s → **the turn home** — the
  object turns through the edge (wind-up 87 %), and what comes back from the
  sliver is **the ink** — the de-extrude hidden at the one angle where depth is
  the whole image → flat drawing, dead-on, exact → **the news:** joint breaks
  open (one, then the rest — F5/F6 grammar from the 2D board) → final hold,
  40 fr, the film ends on the drawing.
- **Breakdowns:** pop-in arrival 19–22 % (EC's sheet); turn home 87 % out /
  13 % in; breaks = substitutions, no in-between (the 2D board's B1).
- **Budget:** 2 + 18 + 45 + 28 + 33 + 8 + 40 ≈ **174 fr / 5.8 s.** Short, and
  deliberately: nothing here has a draw.
- **Where it breaks, frame by frame:**
  - *The missing draw.* The 4.667 s of handwriting — the product's other claim
    — does not exist in this option. The hand is asserted by linework and pen
    order only. That is the option's real price and it is structural, not
    tunable. (A "draw plays after the flatten" variant re-adds it but then the
    film ends mid-energy — the draw is a setup device, and nothing follows it.)
  - *The opening pop-in.* If the empty-page open is too short the film starts
    with a glitch; all4 spends 480–3800 ms of empty white before its builds.
    Watch the first 15 frames.
  - *The de-extrude landing.* Must land byte-exact on the drawing (the state
    swap at the edge + affine camera make this constructible; the gate exists —
    K7's return already asserts K1's own picture at 0.00 %).
- **Why it is on the board:** he asked for 3D-first, and this is the version of
  it with a real ending — the reveal runs toward the hand, and the film ends on
  the thing the product actually makes.

---

### O5 · LETTER BY LETTER — *his idea #3, the flagship — one moment becomes a cascade*

**Tells: "every letter of your drawing has a body."** The single whole-word
moment becomes **eleven** small true moments, on the reference set's own
cascade grammar. This is the option that deserves — and below gets — the most
work, because it multiplies the beat's alive-ness without inventing one new
mechanism: each letter-flip is the BUILT turn, scaled to a letter.

**Why per-letter flips survive the head-on trap:** the edge-on sliver of a
letter is its stroke *depth*, which does not shrink with letter width — each
letter's flip still slivers at ~14–24 px, the same event at a smaller width. But
a letter that lands **head-on** lands invisible (§1.1). So the landing pose is
the design decision: **every letter lands at a shared small object-yaw
(~15–18°)** — the word ends as a rank of slightly-turned standing solids, side
walls visible dead-on, like wooden type on a shelf. (At camera C-B even a
head-on landing shows; at C-A the shared-yaw landing is what makes the cascade
visible at all. Both legal; the pose call is §6's.)

**The cadence, designed from the measurements — teach, then spend:**

- **Flip 1 — the D, alone, full ceremony.** Wind-up 87 %, edge dwell 2 fr on
  twos, land at the shared yaw. Then a clean read: **20 fr / 667 ms** — EC's
  own stagger, measured *"exactly, twice."* The audience learns what a flip is
  on one letter (the 2D board's F5 logic, ported).
- **Flips 2–11 — constant rhythm, content accelerates.** Interval locked at
  **460 ms** (Babbu's cascade median, hand-feel irregularity ±80 ms welcome);
  later beats flip **pairs** (oo, dl, es) — EC's third shuffle beat doubles
  head+legs while the interval holds: *"The rhythm doesn't accelerate; the
  content does."* The word gap (Desk · Doodles) gets one silent beat — the
  hand's own grouping, respected.
- Eleven letters in nine beats: D · e · s · k · [gap, silent] · D · o+o · d+l ·
  e+s ≈ **1 × 667 ms + 8 × 460 ms ≈ 4.3 s / 130 fr** of cascade, simultaneity
  never above 1 event per beat.
- Only flip 1 gets the dwell ceremony. Flips 2–11 are **arrival-spaced,
  240–330 ms** each, no dwell — eleven dwells would turn the signature into a
  flicker (DF's 67 ms glyph churn is the measured warning: at that cadence
  *"the eye registers THAT something changed, never WHAT"*).

**The three versions he named:**

- **O5-A · 2D-FIRST.** draw (140) → flat hold (33) → tense (9) → cascade
  (~130) → **THE RANK HELD**, dead still, 66 fr / 2.2 s → return: **all
  letters lie flat in ONE beat** (EC's own exit rule: *"Elements arrive at
  417–500 ms apart and leave four times faster than they arrived, all at
  once"*) → flat + breaks news → hold 33. ≈ **440 fr / 14.7 s.** The longest
  option on the board, and every second of it is accounted for; the runtime is
  the honest cost of eleven moments.
- **O5-B · 3D-FIRST.** Opens on the standing rank (2 empty frames, then the
  rank pops in at 86 %, settles) → held 45 → letters lie down into ink one at a
  time, same cadence run in reverse (first lie-down gets the ceremony) → the
  film ends on the flat drawing + the breaks = the identity ending. No draw.
  ≈ **240 fr / 8.0 s.** Spectacle first, humility last.
- **O5-C · BOTH.** O5-A's cascade up + O5-B's ending grammar — but the return
  is the ONE-beat whole-word lie-down, not a second cascade. Two full cascades
  would run 18 s+ and repeat the trick the film just taught; the reference exit
  rule (leave 4× faster, together) IS the "both" that fits. If Sebs means
  literally both cascades, the second must run ≥ 2× tempo and the budget is
  named now: +2.2 s.
- **Where it breaks, frame by frame:**
  - *The shared-ink junctions.* The word's strokes fuse across letters — the
    s–k region carries the word's one true crossing, and the `esk` cluster is
    the known shred zone (2D board §2.3, watched). A letter cannot flip without
    deciding who owns the shared ink; the s and k may have to flip as a bound
    pair (a content-double, legal), or the cluster's fused ink assigns to one
    letter by stroke index. This is the option's hard geometry question and the
    first thing a build must settle — watch the s–k boundary on flip 3's frames.
  - *Letter axis placement.* Each letter turns about its own vertical centroid
    axis; a mis-placed axis makes a letter sweep sideways instead of turning in
    place (registration per letter: cx of each letter must hold the way the
    word's did — the gate law scales down).
  - *The rank's raggedness.* Eleven letters at a shared yaw with hand-drawn
    baselines will not align like set type — that is the charm and the risk.
    If it reads as a mistake rather than a shelf of hand-cut letters, the yaw
    is too small; push it until the side walls read (frames to judge: the held
    rank at real scale).
  - *Stillness.* During the cascade the non-flipping letters are parked and
    byte-still on twos — the cascade window is mostly stillness (Babbu's is
    bit-identical between pops), so C8 clears — but O5-A's runtime puts the
    first flip at ~45 % placement and the cascade's LAST flip at ~71 %. A late
    finishing accent, DF-adjacent (its wordmark resolve accents at 91.3 %);
    named, not hidden.
- **Why it is the flagship:** it turns the beat's one moment into the thing the
  reference set is best at — a rhythm — using only built mechanisms, at the
  hand's own scale, and it is the option he reached for himself.

---

### O6 · THE CUTAWAY — *the strongest device in the corpus, applied literally*

**Tells: "look away for half a second — your doodle is standing."** The
transform is never shown at all. It is bought with **absence** — the single
strongest measured device in the reference set (EC empties the frame for
625 ms at mad exactly 0.000 before its payoff; all4 blanks 2 frames before
every build and *comes back with the object already dimensional*).

- **Camera C-A or C-B, parked** (C-B if the standing form should cast the floor
  shadow).
- **Key shots:** draw (140) → flat held long — the setup hold IS the beat's
  first half (45 fr / 1.5 s) → **THE ABSENCE** — the ink is gone; the page,
  its ruling and nothing else, **15 fr / 500 ms** (not 2 fr: between two
  near-identical framings a short gap is a jump cut, *"a device of
  disorientation"*; at 500 ms it is a held breath — and the frame is not empty,
  it is F1's shot: *the page your drawing just left*) → the solid **pops in
  already standing** at 86 % scale, settles 750 ms ease-out τ ≈ 200 ms (EC's
  pop-in, number for number) → 333 ms clean read → **HOLD**, 60 fr / 2.0 s →
  the symmetric close: absence 10 fr → the flat drawing is back, breaks open,
  held 33. ≈ **336 fr / 11.2 s.**
- **Breakdowns:** none in the transform — there is no transform on screen. The
  pop-in arrives at 19–22 %. The absences are cuts, one frame each end.
- **Where it breaks, frame by frame:**
  - *The jump-cut line.* Removing ink and popping a solid in the same framing
    is exactly the near-identical-framings cut the grammar warns about. The
    absence length carries the whole defense — under ~350 ms it is a glitch,
    over ~700 ms it is a stall. Watch the absence at 400/500/600 ms.
  - *The product's thesis.* For a tool whose pitch is the transformation,
    hiding the transformation may be the wrong story — the beat says the magic
    happened off-screen. Every prior board leaned the other way ("stay on the
    mark through the seam"); that thesis is ours and unreferenced, and this
    option is what taking the reference set at its word looks like. The
    tension is real and it is Sebs's to resolve.
- **Why it is on the board:** it is the only option built entirely from the
  corpus's proven devices, and its rhythm cannot fail — it has no move to
  mis-space.

---

### O7 · THE LIGHT PASSES — *nothing moves; the light knows*

**Tells: "the light knows it is solid before you do."** The mark never moves.
After the draw and the hold, the scene's raking light swings once across the
page — every tube-top carries a traveling highlight, the cast shadow wheels
around the letterforms, and the page itself answers with nothing, because paper
has no height. The contrast IS the proof.

- **Camera C-B** (at C-A the sweep only modulates tube shading — measured
  near-invisible in the §1.1 A/B; the option needs the shadow to wheel).
- **Key shots:** draw → hold → **THE SWEEP**, one pass, 24 fr / 800 ms,
  ease-out, shadows lengthening then settling into the new rake → a held beat
  → then either the stand (O2 continues, dimension pre-sold) or nothing — the
  radical reading where the word never transforms at all and the film is:
  draw · light passes · hold · end.
- **Where it breaks:** (a) zero precedent — no clip in 13 films moves a light
  source; it is entirely ours and may read as a renderer flexing rather than a
  story; (b) on the ruled grid the sweep must leave the printed lines untouched
  while shading the tubes — a subtle-materials pass that is easy to make muddy
  (the #1 AI-smell tell); (c) as a standalone it answers "is it 3D?" but never
  "what does this product do?" **Honestly the closest of the seven to the weak
  line** — kept because it is the only option that proves dimension with the
  mark fully at rest, and because as a *garnish* (one subtle sweep during any
  option's payoff hold) it may be worth more than as a film. Flagged as such.

---

## 5. The weak bucket — named, with the reason each is dead

Not counted, per the ghost engine's own rule. Each was considered and cut from
logic or from a measurement; recorded so nobody rebuilds one by accident.

| candidate | why it is dead |
|---|---|
| **Any camera-move showpiece** (the shipped tilt→standup→orbit→descend, any orbit "to show it's 3D") | §2. The camera performing the object's verb is the failure this board exists to kill. 9 of 11 reference clips park the camera; the other 2 aren't ours to copy. |
| **A push-in / fill move at the hold** | a dolly on a lone object in an empty frame is a zoom; a zoom communicates magnification, not depth (`storyboarding.md` §4). Spends stillness, tells nothing. |
| **Crossfade / morph in place** (flat and solid co-visible, opacity-blended) | the original defect, twice failed here, and *"not one of them tries it"* across eleven professional clips (`online` §6.3). The dead band at 42–58 % is its signature. |
| **The white blow-out dissolve** (hide the seam in overexposure) | *"Our ground is white paper. There is no brighter state available"* (`online` §7.1). Produces a hole, not a flash. |
| **All-letters-at-once block flip** | 22-at-once was watched reading as damage (2D board §2.3); simultaneity in the reference set is exactly 1. A block flip is a texture change, not a moment. |
| **The 67 ms slot-machine letter cadence** (DF's glyph churn as our flip rhythm) | at 67 ms *"the eye registers THAT something changed, never WHAT"* — the flip's whole job is WHAT. |
| **Ink boil as an option** | it is a texture garnish (EC's 4 Hz boil on a parked frame), available to any option's hold; it answers no part of "how does 2D become 3D." |
| **The stamp / page deformation** (the grid bows under the word's weight) | deforming the page breaks the ground every register stands on, and no engine exists for it; a gimmick that spends the one sacred plane. |
| **Ken-Burns / drift anything** | falsified device — zero sustained translation in any still passage of any reference film (C1). |
| **The kitchen-sink hybrid** (turn to ¾, then stand up, then orbit) | two dimensional reveals answer the same question twice; one thing at a time is the corpus's most consistent finding. Every option above spends its boldness once. |

---

## 6. What needs his call

Open picks, in prose, each with a recommendation and what the other branch
costs. Nothing here is defaulted.

**Call 1 — which option builds.** My recommendation, in order: **O5-A (letter by
letter, 2D-first, one-beat return)** — it is his own strongest idea, it
multiplies the moment instead of enlarging it, and it reuses every built
mechanism; **O2 (the pop-up)** if the product's literal "stands up off the
page" must be performed; **O1 (the turn that lands)** if the next move must be
cheap and certain — it is the shipped beat with §2's cuts applied and nothing
else new. O4 is the best *short* film on the board and the right shape if the
hero should open loud. O3b is the most personal (the hand's own cadence is the
choreography). O6 is the most reference-pure and the least "about" the product.
What choosing O5 costs: runtime (14.7 s) and the s–k shared-ink geometry
question, which must be settled before the cascade is credible.

**Call 2 — the camera (one of C-A / C-B / C-C, §2).** Rec: **C-B for O2/O3/O5**
(everything visible from one chair, gravity never retconned), **C-A for
O1/O4** (the exact head-on drawing is the film's first and last frame). C-C
only if he wants both identity and stature in one film — the cut is
reference-legal but it is the board's only cut, and it must land ≥ 30° apart on
held frames. What C-B costs: the dead-on identity frame never exists. What C-A
costs: the floor shadow never exists (its shadow is the page-plane drop, which
is a build item).

**Call 3 — the letter landing pose (O5).** Shared small yaw (~15–18°, the rank
of turned solids) vs head-on landings under camera C-B. Rec: the shared yaw —
it is the only version where the cascade's result is visible at C-A too, and
the ragged rank is the most his-hand image on this board. Cost: the word ends
posed, not at rest; the one-beat lie-down return exists to resolve exactly
that.

**Call 4 — cascade rhythm (O5).** Constant 460 ms with content-doubling (EC's
law, recommended) vs Babbu's accelerando (792→334 ms). The accelerando reads
as excitement building; the constant-with-doubling reads as a hand keeping
time. Both are measured; the difference is authorship, which is his.

**Call 5 — the grid.** Whisper ruling everywhere (≈ 3–4× fainter, my rec) vs
empty field at the moment (the OG's staging) vs ruling near the baseline only.
The ruling makes the page a page (F1) and gives O2's hinge its printed line to
stand on; the empty field gives the moment the OG's silence. Cost either way is
named in §1.4: today the grid referees the payoff, and that cannot survive.

**Call 6 — does K7's news (the joint breaks) appear in whichever option wins?**
It is built, gated, and it is the 2D register's entire claim (order). Rec: yes
in O1/O2/O4/O5-A as the final-hold news, one junction first; no in O3b (the
hand already carried the film) and O6 (the film's one idea is absence — a
second device dilutes it). Cost of "yes" everywhere: the ending always has two
beats, and options whose ending is their point (O4) must not let the breaks
upstage the flatten.

---

## 7. What this board did not do

- **Nothing was built, nothing rendered beyond evidence frames.** The budgets
  in §4 are budgets; the storyboard's own §6 marks the same caveat on its
  sheet and it binds harder here — no option's exposure sheet has been felt.
- **No new online research.** The two measured corpora (2,942 + 10,373 frames)
  contained every case this board needed; where they are silent (the wake in
  O3a, the light sweep in O7, the absence-on-one-page in O6) the silence is
  quoted and the device is carried as ours.
- **The `esk` / s–k shared-ink question (O5) is named, not solved.** It needs
  the junction data (`findHeroJunctions`) and a per-letter stroke assignment,
  and it is the first thing an O5 build must settle.
- **The page-plane drop shadow (C-A options) does not exist in the engine.**
  Named as a build item in O1/O4; not designed here.
- **Feel is not judged.** Whether any of these is *fun* cannot be answered from
  this page, by anyone — the 2D board's §10.6 admission, still the right one
  to end on.

---

*Written against `docs/research/storyboarding.md`, the same method as
`docs/hero-beat-storyboard.md` and `docs/2d-register-board.md`. Evidence
frames: `docs/verification/animation-options/` (README there names each file
and its exact source timestamps).*
