# Online reference films — what was fetched, and why

Eleven downloaded clips that contain the move the three Desk Doodles reference
films do not have: **a flat mark becoming a dimensional form** (or the inverse —
a dimensional form resolving onto a flat mark). The existing set was measured
across 2942 frames and contains *no dimensional transform at all*
([`../research/reference-film-mechanics.md`](../research/reference-film-mechanics.md) §10.1),
so it can teach construction and pacing but not our hero beat.

Measurements: [`../research/online-reference-mechanics.md`](../research/online-reference-mechanics.md).
Frame evidence and per-frame data: [`../verification/refs-online/`](../verification/refs-online/).

Every claim in the tables below was checked against a **dense labelled contact
sheet per clip** — `<slug>/contact/dense-5fps-NN.png`, built at `fps=5`,
`8×12`, 260 px tiles, each tile stamped with its real source frame number, 23
sheets covering **all eleven clips end to end** (2 075 sampled frames, max gap
200 ms). Where a claim needed a single frame it was re-checked on a native-rate
sheet or a full-resolution still. Regenerate with:

```bash
cd docs/verification/refs-online/tools
/usr/bin/python3 sheet.py <slug> <start_s> <end_s> 5 8 260 ../<slug>/contact/dense-5fps-01.png
```

All files fetched with `yt-dlp` at ≤720p. Videos are reference material, not
project assets — **do not commit them**; they are reproducible from the URLs below.
Post text and comment threads for all eleven are in [`meta/`](meta/)
(`yt-dlp --write-info-json --write-comments`); what the makers actually said is
summarised in the measurement doc §1.1.

> **Six entries in the table below carry a correction.** The "what it is" and
> "why it fits" columns had been written partly from what these clips are known
> to be rather than from what is in the downloaded file, and in six cases the
> file does not contain the claim as written. Each correction is marked
> **[CORRECTED]** with the sentence it replaces and the frames that decide it.
> A citation is not evidence.
>
> ⚠️ **This warning itself was wrong until 2026-07-31.** It announced *"three
> entries … were rewritten"* while exactly **one** row carried the `[CORRECTED]`
> mark — the two corrections the measurement doc had already made in its §6.4
> and §6.5 (`pencil-sketch-extrude`, `all4-idents`) had never been carried back
> into this table, so the falsified sentences were still standing here as
> provenance. That is the failure class this note exists to catch, occurring
> inside the note. The five now-marked rows were checked frame by frame against
> the dense contact sheets in
> [`../verification/refs-online/<slug>/contact/`](../verification/refs-online/)
> (5 fps, 8×12, labelled with real source frame numbers) before being rewritten.

---

## Fetched and measured

| file | source | maker | what it is | why it fits us |
|---|---|---|---|---|
| `extrude-outline-reveal.mp4` | [youtu.be/F-oZnjkY-ak](https://www.youtube.com/watch?v=F-oZnjkY-ak) | After Effects Templates (desc. is its own title; 0 comments) | 20 s · two logo idents, each: a line draws on, closes into an outline, then becomes a solid | **[CORRECTED]** The outline is **not flat** — it is a swept tube in perspective with specular highlights, rotating in 3D from f31 on. And it does not "extrude": it is **replaced by the solid in a single frame** (f63→f64, and f303→f304 in ident B), mid-rotation, with the wire's outer contour identical to the slab's silhouette — `hcorr` 0.996 across the swap. Still the most valuable clip in the set, but for the substitution trick, not for a drawn flat state. |
| `extruded-logo-resolve.mp4` | [youtu.be/BLFKx8uuBj8](https://www.youtube.com/watch?v=BLFKx8uuBj8) | Fast Video Store | 33 s · three idents; extruded 3D forms tumble in perspective. **[CORRECTED]** It previously read *"…and settle into a flat head-on logo"* for all three. **Two of three do** — ident 1 (red, `BestSound`, resolves ~5.0–9.0 s) and ident 3 (green, `HouseCare`, resolves ~27.0–28.0 s). **Ident 2 (the gold `R`, 11.2–21.8 s) never goes flat**: it holds a glossy gradient with speculars from f575 to f653 and then fades straight out to white at f659 (dense sheet `contact/dense-5fps-02.png`). | The **inverse** of our beat, and therefore the same registration problem: the 3D form must land exactly on the flat mark. **Two** instances of a dimensional state being retired into a flat one — and ident 1 is the most useful frame set in the collection for open call 1 (measured: interior SD 42.3 → 0.87, `online-reference-mechanics.md` §9.1). |
| `cartoon-network-popup.mp4` | [youtu.be/Q3wURy5b_nM](https://www.youtube.com/watch?v=Q3wURy5b_nM) | Nightowl Studio (archival — original bumpers by Cartoon Network) | 54 s · a reel of Cartoon Network papercraft bumpers. **[CORRECTED]** It previously read *"broadcast bumpers; a hand opens a flat paper card and a papercraft scene stands up"*, as though that were the whole clip. **The first ~14 s contains no card and no flat→dimensional transform at all** — it is a Samurai Jack papercraft sequence: a layered paper diorama the camera pushes across (f12–f276), a walking paper figure (f276–f372), paper clouds and a rising Aku (f384–f599), a claw slashing a green paper ground (f611–f695) revealing an embossed CARTOON NETWORK (f707–f827), then ~1 s of black (f839–f899). The hand-opens-a-card beat happens **three** times, later: f911→f966 (15.2–16.1 s), ~27.5 s, ~43.3 s (dense sheets `contact/dense-5fps-01..03.png`). | **Our register, our beat, made physically** — in three isolated moments, not throughout. Real paper, real raking light, real cast shadows, and registration solved by a *hinge* rather than by maths. The only professionally-directed work in the set that is both paper and dimensional. The 14 s that are not a card are still useful: they are a masterclass in reading depth off layered paper and shaded interior faces alone. |
| `pulltab-popup-crane.mp4` | [youtu.be/k25v_50P91c](https://www.youtube.com/watch?v=k25v_50P91c) | Nicolas Codron (ncpaperworks) | 7 s · a hand works a pull-tab; a flat paper crane rises off the page and lies back down, repeatedly | The transform performed by a *physical mechanism*, repeated ~6× in 7 s — so the transit can be measured several times over and its variance read. Handheld and amateur; the mechanism is the point, not the shot. |
| `paper-street-stopmotion.mp4` | [youtu.be/ylp_DPjdFOw](https://www.youtube.com/watch?v=ylp_DPjdFOw) | Aaron B. Koontz (Paper Street Pictures) | 10 s · a blade cuts white paper, a cut-out horse stands up off the sheet under raking light | Ink-on-paper register almost exactly: white stock, one light, and **the cast shadow does all the dimensional work**. Shows what a flat mark needs *around* it to read as standing. |
| `origami-crane-fold.mp4` | [youtu.be/djeRnWMDjyc](https://www.youtube.com/watch?v=djeRnWMDjyc) | stephmotion | 14 s · a flat sheet on a warm-lit wooden table folds itself into a crane. **[CORRECTED]** The clip does not open on the table: **f0–f58 (0–2.4 s) is an unrelated letterboxed title bumper**, the cut to the table is at f62, the sheet then lies flat and near-static for ~3.8 s (f96–f187), and **the fold itself is only f192–f226 (8.0–9.4 s)**; two cranes fly out of frame at f298–f322 and the table is empty by f326 (`contact/dense-5fps-01.png`). | Volume arriving by **folding** rather than extruding — the answer that keeps the material honest (no new mass is invented, the sheet is only bent). The ground is a warm wood table under one hard pool light, so the dimension is sold entirely by the cast shadow. |
| `origami-logo-fold.mp4` | [youtu.be/9PfgidScCxc](https://www.youtube.com/watch?v=9PfgidScCxc) | Yuval Nathan | 31 s · white paper folds into dimensional forms and flattens back, on a white ground | The same fold logic on a **white-on-white** ground, which is our ground. Contains both directions (flat→dimensional and dimensional→flat) and a genuinely flat rest state. |
| `popup-book.mp4` | [youtu.be/3E8vDN2-0jE](https://www.youtube.com/watch?v=3E8vDN2-0jE) | Tea Flower | 50 s · CG pop-up book; five separate spreads rise off a flat page | Five clean, isolated, well-lit instances of the pop-up transit — the largest single sample of the move in the set. CG, so the material won't transfer, but the *timing* is directly comparable. |
| `all4-idents.mp4` | [youtu.be/sXnf8vyL00Q](https://www.youtube.com/watch?v=sXnf8vyL00Q) | Jukalive (archival — original idents by Channel 4 / 4creative) | 85 s · 17 of the 2018 All 4 idents, cut back to back on a 5-second grid, each separated by empty white. **[CORRECTED]** It previously read *"coloured blocks scattered in 3D space align, from one viewpoint only, into the flat '4'"*. **No aligned flat "4" appears anywhere in the 85 s.** The nine blocks are assembled and oblique for the entire runtime; each ident builds them up, plays a vignette (spikes, an ant, a saw, melting…), and ends by cutting to white or shrinking away. Checked at 5 fps across the whole file (425 frames, max gap 200 ms — `contact/dense-5fps-01..05.png`) and at full resolution on two separate idents (`stills/f1150.png`, `stills/f1900.png`). That sentence was written from knowledge of the Channel 4 brand, not from these frames. | **Still the strongest registration answer in the set — for a different reason than was claimed.** What the file contains is *flat plates lying in the ground plane growing upward from a footprint that never moves*: at f1126 (45.040 s) the whole assembly is **14 px tall in a 360 px frame**, by f1139 it is 188 px (`tools/calls.py` M1). Registration is free because nothing translates. Broadcast-grade, four instances. |
| `pencil-sketch-extrude.mp4` | [youtu.be/3yLlI65B808](https://www.youtube.com/watch?v=3yLlI65B808) | Fiverr Gigs Logo Animations | 20 s · two idents; pencil hatching scribbles a mark, which becomes a solid extruded logo. **[CORRECTED]** It previously read *"the only clip found where the flat state is **drawn in pencil**"*. The mark **is** drawn in pencil but it is **never seen flat**: it sits on a plane already rotating in perspective from f10 on, and by f30–f55 it is a shaded 3D object wearing a hatching texture (`01-sketch-to-solid-25fps.png`, `contact/dense-5fps-01.png`). | Kept anyway, because the **handover** from a hand-made surface to a manufactured one is exactly the seam our beat has to cross — and because it is the one clip in the set that genuinely does hide that seam in a white blow-out (measured: frame mean L 174 → 229 and dark pixels 60 306 → 3 887 across f50→f64). The chrome payoff is not our register; the handover is. |
| `stacked-extrude-pin.mp4` | [youtu.be/o6Ye2GS7n0o](https://www.youtube.com/watch?v=o6Ye2GS7n0o) | Fast Video Store | 8 s · a stroke draws in the dark, multiplies into a stack of offset copies, then fuses into one solid | Depth built as a **stack of slices that then fuses** — the literal form of our own `stack` → `fusion` phases, staged as a visible event rather than a shader. |

## Post text and replies — what was actually read, per file

`yt-dlp --write-info-json --write-comments`, saved in [`meta/`](meta/). The
`description` field is the post text; `comments` is the thread. **Nothing here
is "unreachable" — every one of the eleven has both fields on disk**, and the
count below is `comment_count` read out of the JSON, not an estimate. What is
missing is not access, it is content: nine of the eleven say nothing about
technique.

| file | post text | comments | technique stated by the maker? |
|---|---|---|---|
| `origami-crane-fold` | 419 chars | 7 (3 are maker replies) | **Yes.** *"This video was animated at 12fps (I normaly animate at 24fps)… it gives the animation a special look."* Tags include `12fps`, `Kubo`, `Leika`, `Aardman`. The maker reply adds only *"I remember it took quite some time but was a fun experience"*. |
| `origami-logo-fold` | 506 chars | 0 (none exist) | **Yes.** *"Reveal your logo through origami white paper folding stop motion animation. — The animation was shot in high resolution photographs that enable you to scale the animated logo in 240% without loosing resolution info."* Real paper, photographed as stills. |
| `cartoon-network-popup` | 106 chars | 2 | **Second-hand only.** The line *"These all seem to be fully functional papercrafts with no digital or animated components. Very impressive!"* is the **description**, written by the archivist Nightowl Studio, not by Cartoon Network. Both comments are chatter (a list of missing shows; one spam string). |
| `pulltab-popup-crane` | 236 chars | 0 (none exist) | Partly. *"A simple pull-tab-animated movable crane or designer's lamp (crafted in 2019). At the time most probably inspired by the lamp on my desk! a simple and effective mechanism."* Names the mechanism, not how it is built. |
| `popup-book` | 9 chars — the single word *"reference"* | 9 | **No, and the thread proves it stays unknown.** Seven of the nine ask for a tutorial or "how to make"; one asks *"can I ask what software did you use?"* — **unanswered**; one asks permission to reuse it. The maker never replies. This is why the clip is treated as CG on the frames alone. (An earlier draft said *"all nine"* ask for a tutorial; seven do.) |
| `all4-idents` | empty (tags: `All 4`, `Idents`, `E4`, `Film4`, `4music`, `Channel 4`, `Shorts`) | 30 | **No.** All nostalgia — but **two comments are timestamped shot indexes** listing all 17 idents (`0:01 Spikes · 0:06 Bug grabs the green block · 0:11 …`), which is the only structural map of the file anyone wrote down. Treated as a viewer's list, not the broadcaster's. |
| `paper-street-stopmotion` | empty | 2 | **No.** Both comments are the strings "(H. K.)" and "Hong Kong". |
| `extruded-logo-resolve` | 743 chars | 0 (none exist) | **No.** Sales copy: *"extruded depth, strong shadows, and smooth cinematic motion"*, then pricing. |
| `stacked-extrude-pin` | 918 chars | 0 (none exist) | **No.** Sales copy: *"uses solid, extruded 3D text and sleek motion"*, then pricing. |
| `pencil-sketch-extrude` | 2 278 chars | 0 (none exist) | **No.** A Fiverr order form plus ~250 words of keyword spam. |
| `extrude-outline-reveal` | 47 chars — the description **is** the title | 0 (none exist) | **No.** |

"0 (none exist)" is `comment_count: 0` in the JSON — comments are off or the
video has none. It is not a fetch failure; nothing was blocked or rate-limited
on any of the eleven.

## Considered, downloaded, not carried forward

Kept out of the measured set for the reason given; all are re-fetchable.

| source | why not |
|---|---|
| [`0E4rdyq8YqQ`](https://www.youtube.com/watch?v=0E4rdyq8YqQ) Color Extrusion Logo (Solias) | Same 3D→flat resolve as `extruded-logo-resolve`, but shot through heavy bloom — no measurable silhouette at either end. |
| [`DoHCMslNDRU`](https://www.youtube.com/watch?v=DoHCMslNDRU) Logo Openers 01 Extruded (ZOOBA) | Shards resolve to a flat logo in <1 s under motion blur; too fast and too soft to break down. |
| [`RolcL9bX5uI`](https://www.youtube.com/watch?v=RolcL9bX5uI) Soft 3D Extrusion Logo (ZANIMOTION) | Pin-art field. The "flat" state is never flat — it is a 3D grid seen head-on — so it cannot answer the registration question. |
| [`xkU7ZSvZ9ZY`](https://www.youtube.com/watch?v=xkU7ZSvZ9ZY) Pop-up Book (digidrop) | Pop-up is real but the camera orbits throughout, so scale/pose changes cannot be separated from camera motion. |
| [`8LQRuEyt568`](https://www.youtube.com/watch?v=8LQRuEyt568) Stop Motion Paper Logo Reveal | Paper, hands, right register — but the assembly is flat-on-flat. No dimensional transform. |
| [`1c7EH6uW_ag`](https://www.youtube.com/watch?v=1c7EH6uW_ag) Paper, Coffee and Ink CFTV logo | Real objects assembling, but the camera is oblique and drifting for the whole clip and the payoff is flat. |
| [`IoN2o_WoqqM`](https://www.youtube.com/watch?v=IoN2o_WoqqM), [`YJ-EVn8socs`](https://www.youtube.com/watch?v=YJ-EVn8socs) Origami logo templates | Flat planes rotating in 3D. Nothing gains volume; superseded by `origami-logo-fold`. |
| [`uNt_nqc6NKY`](https://www.youtube.com/watch?v=uNt_nqc6NKY) Blueprint Ink Pencil draw Logo Intro | Draw-on is nice, but the payoff is a flat photographic disc — the beat never becomes dimensional. |
| [`uydubY1la0c`](https://www.youtube.com/watch?v=uydubY1la0c) Channel 4 ident "strawberries" | Fan-made homage, not the broadcast ident; superseded by `all4-idents`. |

## Wanted but not fetchable

Recorded here rather than dropped. None of these could be downloaded and measured;
they are listed for a human to watch, and the claims about them are **not measured**.

| what | where | why we wanted it |
|---|---|---|
| **Art of the Title** — the canonical title-sequence archive | [artofthetitle.com](https://www.artofthetitle.com/) | The archive the brief names. Its player is Vimeo-embedded per-article and is not a downloadable catalogue; individual sequences would each need licensing. Use it as a *watching* reference, not a measuring one. |
| Channel 4 idents, original broadcast masters (4creative / MPC, 1982– and 2018–) | rights-held by Channel 4 | `all4-idents.mp4` is a YouTube archival capture at 640×360 — enough to measure timing, not enough to read edges. Better masters would sharpen the registration read only. |
| Cartoon Network papercraft bumpers, original masters | rights-held by Cartoon Network | Same: `cartoon-network-popup.mp4` is an archival capture. Good enough for timing and hold ratios; the paper grain is compressed away. |
| **A-ha, "Take On Me"** (Steve Barron, 1985) — pencil sketch ⇄ live action | commercially licensed | The most famous flat-drawing-becomes-real beat there is. Rotoscoped, so it is a *rendering* change rather than a dimensional transform — would not have answered the registration question anyway. |
| **Paperman** (Disney, 2012) — hand-drawn line living on CG volumes | commercially licensed | The best existing answer to "ink that has volume without stopping looking like ink". Directly relevant to our register; unobtainable here. |
| **Kubo and the Two Strings** origami sequences (Laika, 2016) | commercially licensed | Paper gaining volume, at feature-craft level. |
