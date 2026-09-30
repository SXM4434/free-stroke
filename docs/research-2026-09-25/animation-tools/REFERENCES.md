# Animation tools: what the outside tools do

Research lane, 2026-09-25. Reads `DESIGN.md` and checks the tools it never looked at. No product code changed. No browser was opened: web search, page fetches, `npm pack`, and one Node script.

Images live in `refs/`. Every one listed here was opened and looked at; what I saw is written under it.

**Not reached, because the lane hit its 150k context gate:** DaVinci Resolve's ripple naming could not be confirmed (its forum returned 403; see §10). Figma Smart Animate's matching rules were not read beyond its easing page.

---

## 1 · Theatre.js: the five checks from DESIGN.md §6

Checked against `@theatre/core`, `@theatre/studio` and `@theatre/r3f` 0.7.2, pulled with `npm pack` and run in Node 25.

| check | answer | how I know |
|---|---|---|
| 1. licence | **core: Apache-2.0. studio: AGPL-3.0-only.** r3f: Apache-2.0 | `package.json` inside each tarball, and the npm registry |
| 2. size | **core 50 KB gzipped** (225 KB raw). **studio 244 KB gzipped** (776 KB raw), on top of core | `gzip -9` of each `dist/index.js`. Bundlephobia gives core 31 KB min+gz; studio was rate-limited |
| 3. driven from our clock | **Yes.** Set `sheet.sequence.position` and read the value back in the same tick, with Theatre's own playback never started | ran it, below |
| 4. headless | **Yes.** Core ran in Node with `typeof window === "undefined"` and returned correct values | same run |
| 5. Studio on our data | **No, not directly.** Studio owns its own copy of the state in Theatre's schema and keeps it in `localStorage` | read from the studio bundle and its types, below |

**The run (checks 3 and 4).** One object with one prop, `depth`, keyed 0 at 0 s and 1 at 2 s, loaded from a state object I wrote by hand. Setting `position` and reading `val(obj.props.depth)`:

```
pos 0    depth 0.0000
pos 0.5  depth 0.1059
pos 1    depth 0.5000
pos 1.5  depth 0.8941
pos 2    depth 1.0000
pos 3    depth 1.0000   (held past the last key)
```

The values move with the position and follow the ease, so the read is live and not a cached default. `createRafDriver()` plus `driver.tick(ms)` fired `onChange` twice from our own tick, so no `requestAnimationFrame` loop of Theatre's is needed. The script is `th/t.cjs` in the lane scratchpad and is not kept in the repo.

**Check 5 in detail.** `getProject(name, { state })` takes a JSON state we can own, and core only ever reads it. Studio is different:
- `studio.initialize({ persistenceKey, usePersistentStorage })` stores its working copy in `localStorage` under `theatrejs:0.4` by default.
- When that browser copy and the state passed in code disagree, Studio shows its own conflict prompt. The bundle carries the strings "browser's state will override the disk state" and `browserStateIsNotBasedOnDiskState`.
- To get edits out, we call `studio.createContentOfSaveFile(projectId)` or listen with `onChange`, then translate from Theatre's shape (`sheetsById > sequence > tracksByObject > keyframes[{position, value, handles[4], type}]`) into our `Take`.
- Studio mounts as its own full overlay: outline, props panel, sequence editor. `IStudioUI` exposes only `hide()`, `restore()` and `renderToolset()`. There is no API to mount just the graph editor inside our strip.

**Maintenance.** Last release 0.7.2 on 2024-05-19, 16 months ago. The last commit on `main` is 2024-04-11, titled "Add the 1.0 notice". The README says development moved to a private repo for 1.0 and "Terms and license will remain OSS". 119 open issues and 22 open PRs; not archived; 12.7k stars.

**What I saw** (`refs/theatre-dom-f40.png`, frame 40 of the README's DOM demo): the sequence editor docked under the page. One header row per object ("Box"), one row per prop ("y", "stretch") under it. Keys are small teal diamonds joined by a teal bar where they tween. Below the rows, a graph panel draws the selected props' value curves, orange and green, with round bezier handles on stalks. Ruler reads 0s, 15f, 1s, 15f, 2s, and the playhead is a cyan line with a flag.

Source: [github.com/theatre-js/theatre](https://github.com/theatre-js/theatre), [npm @theatre/studio](https://www.npmjs.com/package/@theatre/studio), [projects and state](https://www.theatrejs.com/docs/latest/manual/projects).

---

## 2 · After Effects: Trim Paths and the graph editor

**Trim Paths.** Start, End and Offset as percentages of the path. With several paths above it in one group, **Trim Multiple Shapes** is either *Simultaneously* (every path trims at once) or *Individually* (the paths draw one after another in stacking order, **sharing one Start/End keyframe range**). There is no per-path timing inside one Trim Paths. To time one path on its own, the user splits it into its own layer or group with its own Trim Paths and slides that one's keys. The Adobe community answer for "time each group" is: split them into layers, or buy a script.

**Graph editor.** Two views of the same keys:
- **Value graph**: y is the property value. A steep slope is fast, flat is still.
- **Speed graph**: y is the rate of change. A peak is fastest, zero is stopped. Easy Ease sets speed 0 at the key with **influence 33.33%** on each side; dragging a handle sideways changes influence (how long the ease lasts), dragging it up or down changes the speed at the key.

**Retime one element:** drag the layer bar (all its keys move), or select keys and Alt-drag the first or last one to scale them in time.

**What I saw** (`refs/ae-value-vs-speed.png`, from School of Motion): a diagram, not AE's UI. Left, an S-curve from bottom-left to top-right, two yellow handles lying flat, each labelled 33%. Right, the same move as a hump: zero at both ends, peak in the middle, handles again 33%. The speed hump makes "where is it fastest" readable at a glance; the S-curve hides it.

Sources: [School of Motion, graph editor](https://schoolofmotion.com/blog/graph-editor-after-effects), [OlafMotion, speed vs value](https://olafmotion.com/motion-knowledge/speed-graph-vs-value-graph-after-effects/), [Adobe community, Trim Individually](https://community.adobe.com/t5/after-effects/path-trimming-of-groups-in-one-layer-as-sequence/m-p/10297745). Adobe's own helpx pages returned 403 to a fetch.

---

## 3 · Rive: timeline and keys

- One row per keyed object, properties under it. Grey diamonds are object-level keys, blue are property keys.
- Drag keys to move them. **Alt-drag the first or last key of a selection to stretch or squeeze the whole selection in time**, spacing kept proportional.
- Interpolation per key, set in a panel to the right of the timeline: **Hold, Linear, Cubic, Elastic** (amplitude and period), plus **Cubic Value**, which puts free bezier handles on the graph so a value can overshoot.
- A Graph Editor toggles over the timeline. A work area narrows playback to a range. Playback speed can go negative.

**What I saw** (`refs/rive-key-stretch.png`, three frames of Rive's resize GIF): keys on "Group" and two "Root Bone" rows spread from 0f to 40f. Mid-drag the selection is squeezed to about 14f to 27f and the dragged keys turn orange. In the last frame they are spread out again to 0f to 40f with the same relative gaps. The Interpolation panel on the right shows four curve icons.

Sources: [Rive keys](https://rive.app/docs/editor/animate-mode/keys), [Rive timeline](https://rive.app/docs/editor/animate-mode/timeline), [Rive interpolation](https://rive.app/docs/editor/animate-mode/interpolation-easing).

---

## 4 · Cavalry: Stagger, Trim, time offset

- **Stagger** is a behaviour that outputs one value per Id in a Duplicator or per character in text: the first Id gets Minimum, the last gets Maximum, the rest are read off a **graph** the user bends.
- Wired to a Duplicator's **Shape Time Offset**, it retimes each copy: `Stagger value + current frame = that copy's time`. Min -11, Max 0 at frame 20 gives Id0 frame 9, Id1 frame 15, Id2 frame 20. The docs tell you to **flip the graph** so the first Id moves first, and to keep Max at 0 so nothing starts before frame 0.
- **Trim** lives on the Stroke utility: Start, End, **Travel** (slides the drawn piece around the shape), Reverse Path, and a taper with Start and End width. That is our window, with a taper, as one set of dials.

**What I saw** (`refs/cavalry-stagger-graph.png`): a small "Stagger.graph" window. X runs from `Id<first>` to `Id<last>`, Y from 0 to 200; a straight white line with the middle Id reading 100. Three curve presets and a flat preset down the right edge, two flip buttons bottom right.

**What it informs:** one curve over stroke index is how you offset twenty strokes without dragging twenty bars.

Source: [Cavalry Stagger](https://cavalry.studio/docs/nodes/behaviours/stagger/), [Cavalry Stroke](https://cavalry.studio/docs/nodes/utilities/stroke/).

---

## 5 · Jitter

- One rounded bar per animation, labelled "Layer · Operation" (for example "EST. 1992 · Move").
- **Drag the body to move it; drag either end to change its duration.** The help says it plainly: longer is slower, shorter is faster. Arrow keys nudge by milliseconds.
- **Stagger:** select several, right-click, Stagger, type a delay. Each start is offset by that delay.
- Easing is per animation: presets, or Custom with two bezier handles and numbers under the graph.
- The help page says nothing about ripple. Moving one bar leaves the others where they are.

**What I saw** (`refs/jitter-stagger.png`): six bars "Reveal 01" to "Reveal Final comp", first grey and stacked at 0, then purple and stepped into an even staircase, each the same length. (`refs/jitter-duration.png`): a selected bar turns purple with a small white grip at each end and a ↔ cursor on the left end; unselected bars are light grey. In the last frame, three selected bars are longer together and the bar under them starts later, which looks like the whole selection stretched as one group. I did not confirm that from text.

Sources: [Work with the Timeline](https://help.jitter.video/en/articles/14111802-work-with-the-timeline), [custom easings](https://jitter.video/changelog/2025-02-18-custom-easings/).

---

## 6 · Figma Smart Animate and its curves

- Curve is one menu per transition: Linear, Ease In, Ease Out, Ease In And Out, three Back variants, Custom Bezier, and springs (Gentle, Quick, Bouncy, Slow, Custom with stiffness, damping, mass).
- Custom Bezier: ends pinned at (0,0) and (1,1), two handles, a text field with `x1, y1, x2, y2` in CSS order, and handles allowed outside the box for overshoot.

**What I saw** (`refs/figma-custom-bezier.png`): the Interaction panel with Curve "Custom", Duration 300ms, a square graph with an S-curve and two black handles, the field "Bezier 0.7, -0.1, 0.4, 1.1" under it, and a tiny preview of the transition below that. Callouts show x and y axes, the pinned ends, the curve and the handles.

**What it informs:** our `Ease` type already matches this exactly (`cubicBezierEase(x1, y1, x2, y2)`). Numbers under the curve are cheap and they make a curve copyable.

Source: [Figma easing and springs](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations).

---

## 7 · Spline

- Timeline panel at the bottom, one row per object with its properties. Keys record automatically once an object is on the timeline. Several timelines per scene, each started by an event.
- Built-in graph editor for speed and easing. Export to video with duration and FPS.

**What I saw** (`refs/spline-graph-editor.png`, a frame of the blog's graph editor video): three spheres over a slab. Bottom panel: rows "Sphere / Position", "Sphere 2", "Sphere 3", "Base". The graph shows Position Y as a green value curve bouncing between keys, grey bezier handles on each key, and the keys repeated as blue dots on a bar underneath. Playhead pill reads 0.80. An "Edit Keyframe" panel on the right shows Time 130 and Position 292.87 for the selected key.

**What it informs:** the key row and its curve can share one lane, so the user never leaves the timeline to shape a curve.

Source: [Spline blog, timeline](https://blog.spline.design/introducing-3d-timeline-animation), [Spline docs](https://docs.spline.design/designing-in-3-d/timeline-animation).

---

## 8 · GSAP timeline

- A timeline places tweens with a **position parameter**: absolute `1.5`, relative `"+=0.5"`, a label, or `"<"` / `">"` for the previous tween's start or end.
- A paused timeline is driven from outside with `time()`, `progress()` or `seek()`. `shiftChildren(amount, adjustLabels, ignoreBeforeTime)` moves everything after a time, which is ripple as an API.
- **Licence: GSAP 3.15.0 (2026-04-13) ships under Webflow's "Standard no-charge" licence, which is not open source.** It bars use in "tools that allow users to build visual animations without code" that compete with Webflow's animation building. Free Stroke's animation tools are that kind of tool. **Do not put GSAP under the product.** Its vocabulary is still worth taking.

Sources: [.claude/skills/gsap-timeline/SKILL.md](../../../.claude/skills/gsap-timeline/SKILL.md), [GSAP Timeline docs](https://gsap.com/docs/v3/GSAP/Timeline/), [GSAP standard licence](https://gsap.com/standard-license).

---

## 9 · Perform it: apps that record a take

| app | what the user does | what it keeps |
|---|---|---|
| **Procreate Dreams, Perform** | Tap Perform, see a pulsing record dot, drag on the stage while the playhead runs. Lift to pause, drag again to resume | Keys on a track under the content. Re-performing the same property overwrites it; a different property (move, then scale) layers on. A **Motion filtering** slider: 0% keeps every twitch, higher smooths |
| **After Effects, Motion Sketch** | Drag the layer while AE plays the work area | Position keys with his timing. **Capture speed at**: 200% gives him twice the real time to draw, played back at normal speed. Smoothing thins keys to beziers |
| **Apple Motion, Record** | Press Record, play, change any parameter | A key on every frame changed. **Mark > Recording Options** sets Keyframe Thinning: Off, Reduced, Peaks Only |
| Rive, Framer | Searched both; found no record-a-take feature | |

**Best example of "draw the timing by hand": Procreate Dreams Perform**, because it runs on the pen, pauses on lift, and treats a re-take as an overwrite. After Effects adds the one control Dreams lacks: capture speed, so he can perform slowly and play it back at speed.

Sources: [Procreate Dreams Performing](https://help.procreate.com/dreams/handbook/keyframes-and-performing/performing), [recorded motion plays back differently](https://help.procreate.com/articles/DEJu8e-recorded-motion-is-playing-back-differently-from-how-it-was-performed), [Motion Sketch, Pond5](https://blog.pond5.com/755-after-effects-tip-using-motion-sketch/), [Apple Motion, animate on the fly](https://support.apple.com/kb/PH16103?locale=en_US), [Motion keyframe thinning](https://help.apple.com/motion/mac/5.0/en/motion/usermanual/chapter_12_section_15.html). No images saved for this section.

---

## 10 · Ripple: do later strokes slide along?

| app | default when you lengthen or move one item | the other behaviour, and its name |
|---|---|---|
| **Final Cut Pro** | **Ripples.** The magnetic timeline pushes later clips along and closes gaps | **Position tool (P)**: moves without rippling and leaves a gap clip |
| **Premiere Pro** | Selection tool does not ripple | **Ripple Edit tool (B)** ripples; **Rolling Edit (N)** keeps total length; **Ripple Delete** (Option+Delete) |
| **After Effects** | Does not ripple. Dragging a layer bar moves only that layer | **Extract Work Area** ripples a removed range shut; **Lift Work Area** leaves the gap. Ripple on move needs a paid script |
| **DaVinci Resolve** | Not confirmed this lane. Search results say ripple, roll, slip and slide all live in **Trim Edit mode**; the forum thread that explains it returned 403 | |
| Jitter | Does not ripple, from its help and GIFs | Stagger sets offsets instead |

The word every editor uses is **Ripple**, and every one offers both behaviours. Final Cut makes ripple the default and gives a one-key way out; the others do the reverse.

Sources: [Final Cut, arrange clips](https://support.apple.com/guide/final-cut-pro/arrange-clips-in-the-timeline-verc147f195/mac), [Premiere ripple edits](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-ripple-edits.html), [AE arranging layers](https://helpx.adobe.com/after-effects/desktop/work-with-layers/select-and-arrange-layers/selecting-arranging-layers.html), [Resolve trim, PremiumBeat](https://www.premiumbeat.com/blog/dynamic-trim-tool-resolve/).

---

## Verdict: Theatre.js for Phase 3

**No.** Keep the curve editor ours, on `cubicBezierEase`, as DESIGN.md §6 says to do when the checks fail.

- **Checks 3 and 4 pass.** Core runs headless and takes our clock. That part fits.
- **Check 5 fails.** Studio keeps its own state in `localStorage`, resolves conflicts in its own prompt, and has no way to mount only its graph editor. Using it means keeping two copies of the keys and a translator between them, which is the second clock by another route.
- **The licence fails for shipping.** Studio is AGPL-3.0-only. Shipping it to visitors on `/` puts the site under AGPL's source obligations. Theatre's own pattern is Studio in development and core in production, and our editor has to be in production, because he edits there.
- **Weight:** 244 KB gzipped for Studio, on top of 50 KB for core, for one curve widget.
- **Maintenance:** no public release in 16 months, and 1.0 in a private repo.

Core on its own would be 50 KB to interpolate keys we already interpolate in a dozen lines. No reason to take it.

## Per phase: the one reference to copy

| phase | copy | what to copy |
|---|---|---|
| **1b the strip** | **Jitter** | One rounded bar per stroke. Drag the body to delay, drag an end to change speed. Selected bar filled, others grey, a small grip at each end, a ↔ cursor on hover. Later bars stay put. For "slide along", copy Final Cut's name and toggle: **Ripple**, on one key |
| **2 perform** | **Procreate Dreams Perform** | Pen-down records, lift pauses, a re-take of the same stroke overwrites it, a smoothing slider at 0% by default. Add After Effects' **capture speed** so he can perform at half speed |
| **3 keys and curves** | **After Effects speed graph**, drawn the way **Spline** lays it out | Keys as diamonds on the stroke's own row, with the curve opened in the same lane. Show speed, not value: where the pen is fastest is the thing he is shaping. Default ease at influence 33%. Numbers under the curve in Figma's `x1, y1, x2, y2` order |
| **4 custom presets** | **Cavalry Stagger** | A preset is one curve over stroke index plus one ease. "Custom (from X)" opens that curve for editing; a saved preset is the curve and the ease, not a list of twenty bars |
| **5 camera** | **Apple Motion Record with Keyframe Thinning** | Let him move the camera during playback and keep the take, then thin it to "Peaks Only" so the move has few keys, each easing in and out, and a hold is a flat span |

Nothing was built. These are references for the build lanes.
