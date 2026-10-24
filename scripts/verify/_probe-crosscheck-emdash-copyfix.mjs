/**
 * F113 finding 9, the copy half, APPLIED 2026-09-22.
 * The rewritten assert-no-em-dashes finds 116 em dashes in user-facing copy that
 * the old regex gate called clean. This holds one decided rewrite per dash, his
 * rule applied: end the sentence or use a comma, never an en dash or brackets,
 * wording otherwise kept. A colon is used only where a list or figures follow
 * (5 places). All 117 were read in context before applying; 9 were changed from
 * the first draft, and each of those keeps that draft under "prepared".
 *
 *   node scripts/verify/_probe-crosscheck-emdash-copyfix.mjs          check: every old text found exactly as often as expected
 *   node scripts/verify/_probe-crosscheck-emdash-copyfix.mjs --apply  write them
 *
 * Before applying: the dev page must be read before and after (curl /desk-doodles
 * held 48 em dashes on 2026-09-22), and scripts/verify/_probe-video-route.mjs
 * matches the text "Rendering the film —" and must be updated with it. After
 * applying, the gate must read 0; the two ` — ` joins it still reports (the
 * desk-doodles phase title at 2819 and the export toast warnings join at 12106)
 * are covered below.
 */
import { readFileSync, writeFileSync } from "node:fs"
const PAIRS = [
{
"file": "lib/dd-engine/deskRenderMode.ts",
"old": "3D — upload→3D is",
"new": "3D. Upload→3D is",
"count": 1
},
{
"file": "lib/dd-engine/fallbackLadder.ts",
"old": "generating — showing",
"new": "generating, showing",
"count": 1
},
{
"file": "lib/dd-engine/fallbackLadder.ts",
"old": "unavailable — using",
"new": "unavailable, using",
"count": 1
},
{
"file": "lib/dd-engine/fallbackLadder.ts",
"old": "unavailable — built",
"new": "unavailable, built",
"count": 1
},
{
"file": "lib/dd-engine/hardPath.ts",
"old": "configured — Edge",
"new": "configured. Edge",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "gel-ink — hard",
"new": "gel-ink, hard",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "balloon feel — broad",
"new": "balloon feel, broad",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "dry clay — fully",
"new": "dry clay, fully",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "reflections — the wet end",
"new": "reflections, the wet end",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "Satin rubber — soft",
"new": "Satin rubber, soft",
"count": 1
},
{
"file": "lib/dd-engine/materials3d.ts",
"old": "inner glow — the screen-lit",
"new": "inner glow, the screen-lit",
"count": 1
},
{
"file": "lib/export/frame-plan.ts",
"old": "fps — the time this",
"new": "fps, the time this",
"count": 1
},
{
"file": "lib/export/index.ts",
"old": "no frame — is anything",
"new": "no frame. Is anything",
"count": 1
},
{
"file": "lib/export/recorder.ts",
"old": "export clock — their speed",
"new": "export clock. Their speed",
"count": 1
},
{
"file": "lib/export/recorder.ts",
"old": "} — video codecs",
"new": "}. Video codecs",
"count": 1
},
{
"file": "lib/geometry-engines.ts",
"old": "\"Fallback — STROKE",
"new": "\"Fallback. STROKE",
"count": 1
},
{
"file": "lib/storage.ts",
"old": "\" — kept aside, not restored",
"new": "\", kept aside, not restored",
"count": 1
},
{
"file": "lib/storage.ts",
"old": "} — kept aside, not deleted",
"new": "}, kept aside, not deleted",
"count": 2
},
{
"file": "lib/style-fusion.ts",
"old": "looking from — head on it rests",
"new": "looking from. Head on, it rests",
"count": 1,
"prepared": "looking from. Head on"
},
{
"file": "lib/style-fusion.ts",
"old": "No relationships yet — nothing",
"new": "No relationships yet. Nothing",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "comes round it — pattern",
"new": "comes round it, pattern",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "across the body — a cheap",
"new": "across the body, a cheap",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "how hard it prints — some passes bite, some wash — while the draw",
"new": "how hard it prints, so some passes bite and some wash. The draw",
"count": 1,
"prepared": "how hard it prints. Some passes bite, some wash, while"
},
{
"file": "lib/style-fusion.ts",
"old": "nothing to write to — its frame",
"new": "nothing to write to. Its frame",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "both CLOCKS — the draw-in",
"new": "both CLOCKS, the draw-in",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "as it swells — the pattern moves",
"new": "as it swells. The pattern moves",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "they swap — two screens",
"new": "they swap, two screens",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "the group swells — the screen belongs",
"new": "the group swells. The screen belongs",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "thins them — one grid",
"new": "thins them, one grid",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "Neither is a parameter — all 21 fusion targets belong to texture, dither, ASCII or material — and",
"new": "Neither is a parameter. All 21 fusion targets belong to texture, dither, ASCII or material, and",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "just been damped — one gesture",
"new": "just been damped, one gesture",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "the tube lights — a sign",
"new": "the tube lights, a sign",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "answers your hand — cloth",
"new": "answers your hand, cloth",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "spreads the grain — two prints",
"new": "spreads the grain, two prints",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "written to two layers — two layers",
"new": "written to two layers, but two layers",
"count": 1,
"prepared": "written to two layers. Two layers"
},
{
"file": "lib/style-fusion.ts",
"old": "how hard they print — one pattern",
"new": "how hard they print, one pattern",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "by construction — no authoring",
"new": "by construction. No authoring",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "the halftone is — two plates",
"new": "the halftone is, two plates",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "on the breath — two rhythms",
"new": "on the breath, two rhythms",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "thins them out — one pattern",
"new": "thins them out. One pattern",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "picks up its rim — all of it",
"new": "picks up its rim, all of it",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "and everything else — the screen's flood, the ink's weight, the characters' edge — is your hand on the object.",
"new": "and everything else is your hand on the object: the screen's flood, the ink's weight, the characters' edge.",
"count": 1,
"prepared": "and everything else is your hand on the object, the screen's flood, the ink's weight, the characters' edge."
},
{
"file": "lib/style-fusion.ts",
"old": "the ring still turns — grain to screen to type and back — and",
"new": "the ring still turns, grain to screen to type and back, and",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "deliberately untouched — so you",
"new": "deliberately untouched, so you",
"count": 1
},
{
"file": "lib/style-fusion.ts",
"old": "different driver — the group, each",
"new": "different driver: the group, each",
"count": 1,
"prepared": "different driver. The group, each"
},
{
"file": "components/style-panel-scaffold.tsx",
"old": "Glyph motion — not pattern",
"new": "Glyph motion, not pattern",
"count": 1
},
{
"file": "components/style-panel-scaffold.tsx",
"old": "not running yet — it needs",
"new": "not running yet. It needs",
"count": 1
},
{
"file": "components/style-panel-scaffold.tsx",
"old": "} — waiting on ",
"new": "}, waiting on ",
"count": 1
},
{
"file": "components/style-panel-scaffold.tsx",
"old": "} — no renderer yet",
"new": "}, no renderer yet",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "from this drawing — try another",
"new": "from this drawing. Try another",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "Rendering the film — ",
"new": "Rendering the film, ",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "` — ${res.warnings",
"new": "`. ${res.warnings",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "px — capped from",
"new": "px, capped from",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "px — ${note}",
"new": "px, ${note}",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "save a still — an export",
"new": "save a still. An export",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "save a film — an export",
"new": "save a film. An export",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "Animated PNG (.png) — lossless",
"new": "Animated PNG (.png), lossless",
"count": 1
},
{
"file": "components/viewport-3d.tsx",
"old": "no contact shadow — a shadow patch",
"new": "no contact shadow. A shadow patch",
"count": 1
},
{
"file": "components/viewport-error-boundary.tsx",
"old": "Reload the page — your drawing",
"new": "Reload the page. Your drawing",
"count": 1
},
{
"file": "components/viewport-error-boundary.tsx",
"old": "still here — rebuilding",
"new": "still here. Rebuilding",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "the screen here — nothing is being",
"new": "the screen here. Nothing is being",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "does not snap back — it unwinds",
"new": "does not snap back. It unwinds",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "through it — if it moved",
"new": "through it. If it moved",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "behind it — and nothing else",
"new": "behind it, and nothing else",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "not a squash — only a real",
"new": "not a squash. Only a real",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "a long settle — that reads",
"new": "a long settle. That reads",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "The three-quarter, held — the best",
"new": "The three-quarter, held. The best",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "full speed — a camera that goes",
"new": "full speed. A camera that goes",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "The drawing, back — carrying",
"new": "The drawing is back, carrying",
"count": 1,
"prepared": "The drawing, back, carrying"
},
{
"file": "app/desk-doodles/page.tsx",
"old": "1 % floor — Natural",
"new": "1 % floor, so Natural",
"count": 1,
"prepared": "1 % floor, Natural"
},
{
"file": "app/desk-doodles/page.tsx",
"old": "\" — the nib is wider",
"new": "\". The nib is wider",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "the text is — what a hand",
"new": "the text is, which is what a hand",
"count": 1,
"prepared": "the text is, what a hand"
},
{
"file": "app/desk-doodles/page.tsx",
"old": "letters fuse — this is",
"new": "letters fuse. This is",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "{ph} — ${beats",
"new": "{ph}, ${beats",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "by arc length — one cycle per 35-90px — displacing",
"new": "by arc length, one cycle per 35-90px, displacing",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "arc backwards — it opens",
"new": "arc backwards. It opens",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "it leaves out — once it is up",
"new": "it leaves out. Once it is up",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "its own edge — the thinnest",
"new": "its own edge, the thinnest",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "How the stand is spaced — the share",
"new": "How the stand is spaced. The share",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "own paths — what you actually",
"new": "own paths, what you actually",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "came back as 10 — half the",
"new": "came back as 10, half the",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "almost nothing — the rank",
"new": "almost nothing. The rank",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "0 is the control — every letter",
"new": "0 is the control. Every letter",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "full ceremony — the pause at the edge included — because",
"new": "full ceremony, the pause at the edge included, because",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "0.467s — the reference",
"new": "0.467s, the reference",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "content thickens — same interval",
"new": "content thickens, same interval",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "says not to — eleven pauses in a row read as a flicker — and built that way,",
"new": "says not to, because eleven pauses in a row read as a flicker. Built that way,",
"count": 1,
"prepared": "says not to. Eleven pauses in a row read as a flicker, and"
},
{
"file": "app/desk-doodles/page.tsx",
"old": "never comes back — the film",
"new": "never comes back. The film",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "the nib drew — thin where",
"new": "the nib drew, thin where",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "Four reads are hidden — how",
"new": "Four reads are hidden: how",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "turn takes hold — one gesture",
"new": "turn takes hold, one gesture",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "changing direction — the hitch",
"new": "changing direction, the hitch",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "in one frame — the single biggest",
"new": "in one frame, the single biggest",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "in front — so the drawing",
"new": "in front, so the drawing",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "0 removes it — which is",
"new": "0 removes it, which is",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "2D to 3D' — at 0 the flat",
"new": "2D to 3D'. At 0 the flat",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "the whole framing — it is set",
"new": "the whole framing. It is set",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "The money angle — where",
"new": "The money angle, where",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "film's framing — there is no push",
"new": "film's framing. There is no push",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "±10% — dips before",
"new": "±10%, dips before",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "beat entirely — moving Swell",
"new": "beat entirely. Moving Swell",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "action plan — a bigger",
"new": "action plan. A bigger",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "reconstructed — and the prior",
"new": "reconstructed, and the prior",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "tapered almond — the edges",
"new": "tapered almond. The edges",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "Quill costs on — 6 blank",
"new": "Quill costs on: 6 blank",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "no taper — blunter",
"new": "no taper, blunter",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "per fragment — a wipe's",
"new": "per fragment, a wipe's",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "Scores 0.264 — it reads",
"new": "Scores 0.264. It reads",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "never the problem — it already",
"new": "never the problem. It already",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "did not before — the old copy",
"new": "did not before. The old copy",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "Fast in — a squash",
"new": "Fast in. A squash",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "takes to uncoil — and it happens",
"new": "takes to uncoil, and it happens",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "own CONTACT — a\n",
"new": "own CONTACT, a\n",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "own clip does — full height",
"new": "own clip does, full height",
"count": 1
},
{
"file": "app/desk-doodles/page.tsx",
"old": "s — the clip's own remainder",
"new": "s, the clip's own remainder",
"count": 1
},
{
"file": "app/page.tsx",
"old": "survive a reload — export it",
"new": "survive a reload. Export it",
"count": 1
},
{
"file": "app/page.tsx",
"old": "SEPARATE RUNS merge — a different",
"new": "SEPARATE RUNS merge: a different",
"count": 1
}
]

const apply = process.argv.includes("--apply")
const files = new Map(), bad = []
for (const p of PAIRS) {
  const s = files.get(p.file) ?? readFileSync(p.file, "utf8")
  const n = s.split(p.old).length - 1
  if (n !== p.count) { bad.push(`${p.file}: found ${n}, want ${p.count}: ${JSON.stringify(p.old)}`); continue }
  files.set(p.file, s.split(p.old).join(p.new))
}
for (const b of bad) console.log(`FAIL  ${b}`)
console.log(`${PAIRS.length} rewrites across ${new Set(PAIRS.map((p) => p.file)).size} files, ${bad.length} not found as expected`)
if (apply && bad.length === 0) { for (const [f, s] of files) writeFileSync(f, s); console.log(`written ${files.size} files`) }
process.exit(bad.length === 0 ? 0 : 1)
