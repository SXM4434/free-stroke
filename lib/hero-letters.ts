/**
 * WHICH LETTER EACH STROKE BELONGS TO — O5's one hard geometry question,
 * answered by the ink rather than by a table.
 *
 * The board (`docs/hero-animation-options-board.md` §4 O5) names this as the
 * first thing a build has to settle and does not settle it:
 *
 *   *"The shared-ink junctions. The word's strokes fuse across letters — the
 *   s–k region carries the word's one true crossing, and the `esk` cluster is
 *   the known shred zone. A letter cannot flip without deciding who owns the
 *   shared ink; the s and k may have to flip as a bound pair (a content-double,
 *   legal), or the cluster's fused ink assigns to one letter by stroke index."*
 *
 * ── THE LAW, AND WHY IT IS NOT A LOOKUP TABLE ───────────────────────────────
 *
 * The hero word is Sebs's own TRACED handwriting (`logo-strokes.json`, 22
 * polylines), not the font. It carries no letter labels and never will — a
 * trace is a list of pen paths. Any hand-written table would be a second source
 * of truth for a fact the geometry already knows, and it would be wrong the
 * moment the trace changed.
 *
 * ⚠ WHICH INK IT IS RUN OVER IS PART OF THE LAW, and it is the PEN'S OWN PATHS.
 * Hand-feel does not only wobble the ink, it PROTRUDES it — every stroke runs
 * past its own end — and a tail run past its end lands in the next letter. Run
 * over the decorated ink this law fused `e` to `s` and `o` to `d` to `l`, and
 * the word came back as six pieces for eleven letters. **A letter is a fact
 * about the hand, not about the ink's decoration.** The measurement and the
 * parked prior are at `app/desk-doodles/page.tsx`'s `letterMap`.
 *
 * So the law is physical: **two strokes belong to the same letter when their
 * INK OVERLAPS — when each one's centreline lies inside the other's ink.** A
 * letter boundary drawn through THAT would tear graphite a viewer sees as one
 * mass. Connected components under that relation ARE the letters, ordered left
 * to right.
 *
 * ⚠ IT USED TO SAY "TOUCHES", AND "TOUCHES" IS A DIFFERENT AND WRONG LAW.
 * See `LETTER_REACH_FRAC` — the distinction is one number and it was worth
 * eleven letters.
 *
 * That answers the board's question in the board's own terms rather than
 * dodging it: where the s and k really do fuse, they come back as ONE component
 * and flip as a bound pair — which the board explicitly calls legal — and where
 * they do not, they are two. Nobody has to decide; the trace decides.
 *
 * ── CALIBRATION ─────────────────────────────────────────────────────────────
 *
 * The font path (`scripts/capture/letters.mjs`) DOES carry an authored
 * `letterOf`, and that is what this law is checked against: run over the font's
 * own polylines it must reproduce the authored map exactly, or the law is
 * wrong. `scripts/verify/assert-hero-options.mjs`'s LETTER MAP rows are that
 * check, and their control is the same law at a threshold that fuses the whole
 * word into one component — a "letter map" with one letter in it, which every
 * downstream row has to reject.
 *
 * ⚠ THE CALIBRATION USED TO BE ONE WORD, AND ONE WORD COULD NOT SEE THE DEFECT.
 * `"Desk Doodles"` in the font has ELEVEN letters and **no two of them come
 * within a nib of each other** — measured, `scripts/verify/_probe-letter-
 * contact.mjs`: `DIFFERENT letters, within a nib (0)`. So that word exercises
 * only the half of the law that MERGES strokes into a letter. It has no opinion
 * whatever on the half that has to DECLINE to merge two letters, which is the
 * only half the traced hero word actually turns on. A green calibration on it
 * was a green light for a decision it never tested — DISPATCH §2.6's exact
 * failure, "a green row that cannot fail is the lie".
 *
 * `"the quick brown fox jumps"` is the word that can fail, it is already in the
 * repo, and it is cited three paragraphs down for the OTHER half of the law.
 * Both words are now run. See `LETTER_REACH_FRAC` for what the second one said.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * Not a gap-in-x test. Measured on the traced word, an x-interval law needs a
 * threshold of 3.0 px to split the k off the s and their nearest ink is 3.7 px
 * apart — well inside one 22 px nib — so it would have split a letter boundary
 * straight through solid ink and the k's stem would have flown away from the
 * arm it is drawn across. The distance law puts them in one component, which is
 * what the picture actually shows.
 *
 * ── ⚠ THE LAW WAS HALF OF ITSELF, AND A DOTTED `i` IS WHAT FOUND THE OTHER
 *    HALF ──────────────────────────────────────────────────────────────────
 *
 * "Two strokes are one letter when their ink touches" answers *when do two
 * letters become one*. It does not answer *when is one letter already two
 * pieces*, and it silently assumed the answer was never. That held for exactly
 * as long as the font had seven glyphs, none of which has a detached part.
 *
 * Once the font grew the rest of the keyboard, `i j ! ? : ; " = % # *` arrived,
 * and every one of them is authored as ink that does not touch. Measured on
 * `"the quick brown fox jumps"` at the hero's own weight: **21 authored letters
 * came back as 24**, because three tittles were each promoted to a letter of
 * their own. A cascade indexing that map flips an `i`'s dot away from its stem.
 *
 * So the law takes a SEED: the grouping the source already knows, which the
 * font path has had all along in `layoutWord`'s `letterOf` and which the page
 * publishes as `FONT_LETTER_MAP`. Strokes sharing a seed start in one component
 * and the ink law then MERGES from there. Both halves of the physics survive —
 * a dot stays with its stem because the font says so, and two letters whose ink
 * really has fused still come back as one bound pair because the geometry says
 * so, which is the case board §4 O5 calls legal.
 *
 * A trace has no seed, passes none, and gets exactly the law it got before.
 * `"Desk Doodles"` has one, and its eleven seeded groups touch nothing, so the
 * merged answer is the same eleven the authored map already gave.
 */

/**
 * HOW CLOSE IS "ONE MASS OF GRAPHITE" — as a fraction of the nib's DIAMETER.
 *
 * ── WHAT IT WAS, AND THE MEASUREMENT THAT KILLED IT ─────────────────────────
 *
 * It was **1.0**, and 1.0 is not "the ink touches" — it is the ink GRAZES. Two
 * round nibs of diameter `w` whose centrelines pass at exactly `w` share a
 * single tangent point and nothing else. The lens they overlap in has width
 * `2·sqrt(r² − (d/2)²)`, which at `d = w` is **zero**. So the shipped law fused
 * two letters on the strength of an intersection with no area.
 *
 * That is not an argument, it is a prediction, and the repo already contains the
 * word that tests it. `lib/hero-letters.ts`'s own note cites `"the quick brown
 * fox jumps"` — 21 authored letters — for the SPLIT half of the law. Run
 * through the MERGE half at reach 1.0 nib, seeded and all
 * (`scripts/verify/_probe-letter-reach.mjs`):
 *
 *     reach/nib   "Desk Doodles" (11)      "the quick brown fox jumps" (21)
 *       1.00           11  EXACT                  10   ❌  eleven letters lost
 *       0.90           11  EXACT                  12   ❌
 *       0.80           11  EXACT                  18   ❌
 *       0.70           11  EXACT                  21  EXACT
 *       0.50           11  EXACT                  21  EXACT
 *       0.20           11  EXACT                  21  EXACT
 *       0.10           11  EXACT                  21  EXACT
 *
 * **At the shipped reach an authored 21-letter word came back as 10.** Not a
 * near miss — better than half the word's letters merged into their neighbours.
 * The one-word calibration could not see it because that word has no two letters
 * within a nib to merge (see the CALIBRATION note above).
 *
 * ── WHAT IT IS, AND WHY THIS NUMBER ─────────────────────────────────────────
 *
 * **0.5 — one nib RADIUS.** At `d = r` each stroke's centreline lies INSIDE the
 * other stroke's ink: the spine of one is buried in the graphite of the other,
 * and the lens they share is `1.73·r` wide, most of a nib. That is a weld, and
 * cutting a letter boundary through it really would tear something you can see.
 * At `d = 2r` neither centreline is inside anything.
 *
 * It is also the middle of the measured safe band. Both authored words are EXACT
 * across 0.2–0.7 and nothing else is; 0.5 sits inside that with 0.3 of margin
 * below and 0.2 above, so the answer does not turn on the third decimal.
 *
 * A DIAL, because the band is real and Sebs may want the ends of it: the page
 * exposes it and `letterMap` relays from whatever it is set to.
 */
export const LETTER_REACH_FRAC = 0.5

export interface LetterMap {
  /** Index-parallel to the strokes: which letter each stroke belongs to. */
  of: number[]
  /** How many letters the word came out as. */
  count: number
}

interface Pt {
  x: number
  y: number
}

/** Squared distance from `p` to the segment `a`→`b`. */
function segDist2(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const dd = vx * vx + vy * vy
  let t = dd > 1e-12 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / dd : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const qx = a.x + t * vx - p.x
  const qy = a.y + t * vy - p.y
  return qx * qx + qy * qy
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

function boxOf(pts: readonly Pt[]): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x0, y0, x1, y1 }
}

/**
 * The smallest distance between two polylines' centrelines.
 *
 * Point-to-SEGMENT on both sides rather than point-to-point: the processed
 * strokes are resampled at ~4 px and a point-to-point minimum can miss a
 * genuine crossing by half a sample. On a 22 px nib that is a 9 % error on the
 * one number the whole assignment turns on.
 */
function polylineDistance(a: readonly Pt[], b: readonly Pt[]): number {
  let best = Infinity
  for (const p of a) {
    for (let j = 1; j < b.length; j++) {
      const d = segDist2(p, b[j - 1], b[j])
      if (d < best) best = d
    }
    if (b.length === 1) {
      const dx = p.x - b[0].x
      const dy = p.y - b[0].y
      const d = dx * dx + dy * dy
      if (d < best) best = d
    }
  }
  for (const p of b) {
    for (let j = 1; j < a.length; j++) {
      const d = segDist2(p, a[j - 1], a[j])
      if (d < best) best = d
    }
  }
  return Math.sqrt(best)
}

/**
 * Assign every stroke to a letter.
 *
 * `inkWidth` is the rendered ink DIAMETER in the same coordinates the strokes
 * are in — `HERO_INK_WIDTH_PX` on the hero page, which is derived from the
 * engine's own thickness mapping rather than restated. Two centrelines closer
 * than `inkWidth · reachFrac` share ink; see `LETTER_REACH_FRAC` for why that
 * second factor exists and what it was worth.
 *
 * Empty in, empty out: a word with no strokes has no letters, and the caller
 * gets `count 0`, which is exactly the value that makes the per-letter shader
 * pass inert.
 */
export function assignLetters(
  strokes: readonly { points: readonly Pt[] }[],
  inkWidth: number,
  /**
   * OPTIONAL: the grouping the source already knows, index-parallel to
   * `strokes` — the font's authored `letterOf`. Strokes sharing a value start
   * fused; the ink law can then merge groups further but never split one. Omit
   * it for a trace, which has no authored answer, and the law is exactly what
   * it was.
   */
  seedOf?: readonly number[],
  /** See `LETTER_REACH_FRAC`. A fraction of `inkWidth`, not of anything else. */
  reachFrac: number = LETTER_REACH_FRAC,
): LetterMap {
  const n = strokes.length
  if (n === 0) return { of: [], count: 0 }

  const pts = strokes.map((s) => s.points)
  const boxes = pts.map(boxOf)
  const reach = Math.max(0, inkWidth) * Math.max(0, reachFrac)

  // Union-find over strokes.
  const parent = new Array(n).fill(0).map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    while (parent[i] !== r) {
      const nx = parent[i]
      parent[i] = r
      i = nx
    }
    return r
  }
  const union = (i: number, j: number) => {
    const a = find(i)
    const b = find(j)
    if (a !== b) parent[b] = a
  }

  /* The seed first, so a glyph's own detached parts are already one component
   * before any distance is measured. Guarded on length: a seed that does not
   * line up with the strokes is worse than none, and silently using half of one
   * is how a map goes wrong in a way nothing downstream can see. */
  if (seedOf && seedOf.length === n) {
    const firstAt = new Map<number, number>()
    for (let i = 0; i < n; i++) {
      const g = seedOf[i]
      if (!Number.isFinite(g)) continue
      const first = firstAt.get(g)
      if (first === undefined) firstAt.set(g, i)
      else union(first, i)
    }
  }

  for (let i = 0; i < n; i++) {
    if (pts[i].length === 0) continue
    for (let j = i + 1; j < n; j++) {
      if (pts[j].length === 0) continue
      // Bounding boxes expanded by the reach: if they do not overlap, no pair
      // of points can be within it. Skips almost every pair on a word.
      const A = boxes[i]
      const B = boxes[j]
      if (A.x1 + reach < B.x0 || B.x1 + reach < A.x0) continue
      if (A.y1 + reach < B.y0 || B.y1 + reach < A.y0) continue
      if (polylineDistance(pts[i], pts[j]) <= reach) union(i, j)
    }
  }

  /* ---- order the components LEFT TO RIGHT ---------------------------------
   * The cascade is a reading order, so the letters have to be numbered the way
   * the word is read and not the way the pen happened to visit them. Sebs's
   * trace draws the D's body, then two small marks, then moves on — stroke
   * order and reading order agree here, but they are not the same fact and a
   * cascade numbered by stroke order would be silently correct until the day
   * somebody dots an i at the end. */
  const roots = new Map<number, { minX: number; y0: number; y1: number; members: number[] }>()
  for (let i = 0; i < n; i++) {
    if (pts[i].length === 0) continue
    const r = find(i)
    const e = roots.get(r)
    if (e) {
      e.members.push(i)
      if (boxes[i].x0 < e.minX) e.minX = boxes[i].x0
      if (boxes[i].y0 < e.y0) e.y0 = boxes[i].y0
      if (boxes[i].y1 > e.y1) e.y1 = boxes[i].y1
    } else {
      roots.set(r, { minX: boxes[i].x0, y0: boxes[i].y0, y1: boxes[i].y1, members: [i] })
    }
  }
  /* ---- LINES BEFORE COLUMNS -----------------------------------------------
   * Reading order on a block of more than one line is row-major, not
   * left-to-right across the whole thing: sorted by x alone, a two-line word
   * cascades the second line's `D` before the first line's `s`, which is not a
   * reading order, it is a zig-zag.
   *
   * Lines are found by vertical OVERLAP rather than by a threshold on the
   * baseline — two letters are on the same line when their ink spans share any
   * y at all, which is true of an `l` and a `.` on one line and false of any two
   * letters on different ones. A single-line word therefore lands in exactly one
   * band and the sort key collapses to `minX`, i.e. to the comparison that was
   * here before. */
  const byTop = [...roots.values()].sort((a, b) => a.y0 - b.y0)
  let bandTop = -Infinity
  let bandBot = -Infinity
  let band = -1
  for (const c of byTop) {
    if (c.y0 > bandBot) {
      band++
      bandTop = c.y0
      bandBot = c.y1
    } else if (c.y1 > bandBot) {
      bandBot = c.y1
    }
    ;(c as { band?: number }).band = band
    void bandTop
  }
  const ordered = [...roots.values()].sort(
    (a, b) =>
      ((a as { band?: number }).band ?? 0) - ((b as { band?: number }).band ?? 0) ||
      a.minX - b.minX,
  )
  const of = new Array<number>(n).fill(0)
  ordered.forEach((c, li) => {
    for (const m of c.members) of[m] = li
  })
  return { of, count: ordered.length }
}

/**
 * WHERE THE WORD GAP FALLS — the letter index after which the cascade takes its
 * one SILENT beat, or −1 if the word does not have a legible gap.
 *
 * Board §4 O5: *"The word gap (Desk · Doodles) gets one silent beat — the hand's
 * own grouping, respected."*
 *
 * ⚠ THE MARGIN ON SEBS'S OWN HAND IS THIN AND THAT IS REPORTED, NOT SMOOTHED.
 * Measured over the eight letters the traced word resolves to, the inter-letter
 * gaps run 40.3 · **41.5** · 22.0 · 40.3 · 15.9 · 33.0 · 22.0 stroke-px. The
 * word space IS the largest — after letter 1, which is `D` + the fused `esk`,
 * i.e. the whole of "Desk", the right answer — but it beats the median by only
 * 26 %, because he does not leave much of a space. A detector that claimed more
 * confidence than that would be lying about a 1.5 px margin.
 *
 * So: the largest gap wins if it clears the median by 15 %, and otherwise this
 * returns −1 and the cascade simply runs without a rest. Either way
 * `HeroMotionParams.letterSilentAfter` is a dial, so the answer is a starting
 * point and not a verdict.
 */
export function letterGapAfter(
  strokes: readonly { points: readonly Pt[] }[],
  map: LetterMap,
): number {
  if (map.count < 3) return -1
  const lo = new Float64Array(map.count).fill(Infinity)
  const hi = new Float64Array(map.count).fill(-Infinity)
  const top = new Float64Array(map.count).fill(Infinity)
  const bot = new Float64Array(map.count).fill(-Infinity)
  for (let si = 0; si < strokes.length; si++) {
    const li = map.of[si]
    if (li === undefined) continue
    for (const p of strokes[si].points) {
      if (p.x < lo[li]) lo[li] = p.x
      if (p.x > hi[li]) hi[li] = p.x
      if (p.y < top[li]) top[li] = p.y
      if (p.y > bot[li]) bot[li] = p.y
    }
  }
  const gaps: number[] = []
  for (let i = 1; i < map.count; i++) {
    if (!Number.isFinite(lo[i]) || !Number.isFinite(hi[i - 1])) return -1
    /* ⚠ THE WORD GAP IS A ONE-LINE IDEA, and this is where that gets said.
     *
     * The measurement is `lo[i] - hi[i-1]` — a horizontal distance between
     * consecutive letters. Across a LINE BREAK that number is not a gap at all:
     * the next letter starts back at the left margin, so it comes out large and
     * negative, and the median it is compared against is polluted by one such
     * value per line. Rather than report a rest in the wrong place, a block of
     * more than one line simply has no detected word gap and the cascade runs
     * without one — `letterSilentAfter` remains a dial either way.
     *
     * A break is two consecutive letters whose ink spans share no y at all,
     * which no two letters on one line can do. */
    if (top[i] > bot[i - 1] || top[i - 1] > bot[i]) return -1
    gaps.push(lo[i] - hi[i - 1])
  }
  if (gaps.length < 2) return -1
  let best = 0
  for (let i = 1; i < gaps.length; i++) if (gaps[i] > gaps[best]) best = i
  const sorted = [...gaps].sort((a, b) => a - b)
  const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  if (!(mid > 0) || gaps[best] < mid * 1.15) return -1
  // `gaps[k]` is the gap BEFORE letter k+1, so the silence goes after letter k.
  return best
}
