// Clean single-stroke vector font for the "Desk Doodles" capture.
// Coordinate space per glyph: x in [0..advance], y with baseline at y=0,
// cap top at y=-100, x-height top at y=-52, descender bottom at y=+34.
// Each glyph is an array of polylines (arrays of [x,y]); the letters draw in
// the order the polylines are listed, which the inflate reveal replays.
//
// ── WHY THIS FILE GREW FROM SEVEN GLYPHS TO THE WHOLE KEYBOARD ──────────────
//
// Sebs, 2026-08-02: *"the 3d text is fully distorted worse when u type ur own
// text."* The lane before this one measured "the quick brown fox jumps" and got
// FIVE DISCS (docs/verification/drawin-holes/sweep-long/carve-0.png, comps 5)
// and reasoned about nib-to-glyph fusion. Fusion is real and is fixed
// separately — but it is the SECOND term. The first term is this file:
//
//   the font drew `D e s k o d l` and a space. Seven glyphs.
//
// Of the 25 characters in "the quick brown fox jumps", **20 draw nothing.** The
// five discs are not fused letters at all: they are the `e`, the `k`, the two
// `o`s and the `s` — the only characters the font could draw — each one alone
// in the middle of its own dead space, and each one swallowed into a blob by
// the second term. `layoutWord` advanced the pen past every other character in
// silence, which is why the defect read as "distortion" rather than as "that
// letter does not exist": a missing glyph and a fused one look identical once
// the word is a row of dots.
//
// So the whole printable ASCII range is authored here, in the same hand as the
// original seven: cap 100, x-height 52, descender +34, left sidebearing ~8,
// stems on the same x, bowls built from the same `arc()` helper. `SUPPORTED`
// publishes the coverage so the UI can name what it cannot draw instead of
// dropping it, and `fold()` maps accented and typographic characters onto their
// ASCII base rather than losing them.
//
// ⚠ THE ORIGINAL EIGHT ENTRIES BELOW ARE UNTOUCHED, TO THE BYTE. "Desk Doodles"
// is the shipped hero word and the traced logo's stand-in; a new `e` would have
// re-cut the film. Everything new is added AFTER them.

const CAP = 100 // cap height
const XH = 52 // x-height

// arc(cx,cy,r, a0,a1, n): polyline sampling an arc, angles in degrees,
// y is screen-down (positive down). Sweeps a0 -> a1.
function arc(cx, cy, r, a0, a1, n = 24) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    const rad = (t * Math.PI) / 180
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)])
  }
  return pts
}

// Each glyph: { adv, strokes: [[ [x,y], ... ], ...] }
const GLYPHS = {
  " ": { adv: 46, strokes: [] },

  // Uppercase D: left stem + big right bowl
  D: {
    adv: 96,
    strokes: [
      [
        [8, -CAP],
        [8, 0],
      ],
      // bowl from top of stem, bulging right, back to bottom of stem
      [
        [8, -CAP],
        ...arc(8, -CAP / 2, CAP / 2, -90, 90, 26),
        [8, 0],
      ],
    ],
  },

  // lowercase e: horizontal crossbar joined into a 'c' loop open on the right.
  // One continuous stroke: bar left->right at mid, then sweep up-over-around-
  // down (ccw through the top and left) ending open at lower-right.
  e: {
    adv: 60,
    strokes: [
      [
        // bar left -> right, then sweep from the right end up over the top,
        // around the left and bottom, opening at the lower right.
        // (theta convention: 0=right, 90=down, 270/-90=up)
        [8, -XH / 2],
        [50, -XH / 2],
        ...arc(28, -XH / 2, 22, 360, 45, 30).slice(1),
      ],
    ],
  },

  // lowercase s: single continuous S curve (top bowl then bottom bowl)
  s: {
    adv: 50,
    strokes: [
      [
        // top bowl: upper-right, over the top, down the left to the junction;
        // bottom bowl: from junction around the right and bottom, open lower-left.
        // Circles share the junction point at y=-26 (r=12.5).
        ...arc(25, -38.5, 12.5, -45, -270, 20),
        ...arc(25, -13.5, 12.5, -90, 135, 20).slice(1),
      ],
    ],
  },

  // lowercase k: tall stem + two diagonal legs
  k: {
    adv: 60,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [
        [48, -XH],
        [12, -XH * 0.42],
      ],
      [
        [24, -XH * 0.62],
        [50, 0],
      ],
    ],
  },

  // lowercase o: full loop
  o: {
    adv: 60,
    strokes: [[...arc(28, -XH / 2, 24, -90, 271, 30)]],
  },

  // lowercase d: right stem (ascender) + left bowl
  d: {
    adv: 64,
    strokes: [
      [
        [46, -CAP],
        [46, 0],
      ],
      [...arc(24, -XH / 2, 22, -20, 340, 28)],
    ],
  },

  // lowercase l: simple ascender stem
  l: {
    adv: 30,
    strokes: [
      [
        [12, -CAP],
        [12, 0],
      ],
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * EVERYTHING BELOW IS NEW — the rest of printable ASCII.
   *
   * Drawn to the metrics the eight above already set, so a word mixing old
   * and new glyphs sits on one baseline with one weight:
   *   cap top -100 · x-height top -52 · baseline 0 · descender +34
   *   left sidebearing ~8 · lowercase bowls r 22-24 · cap bowls r 24-32
   *
   * Stroke ORDER inside a glyph is pen order, because the reveal replays it:
   * stem before bowl on `b d h p`, the way a hand writes them.
   * ═══════════════════════════════════════════════════════════════════════ */

  // ---- lowercase ---------------------------------------------------------

  // single-storey a: the same bowl `d` uses, on a short stem. Two glyphs from
  // one construction is the point — it is what makes them look related.
  a: {
    adv: 64,
    strokes: [
      [
        [46, -XH],
        [46, 0],
      ],
      [...arc(24, -XH / 2, 22, -20, 340, 28)],
    ],
  },

  // b: ascender stem + right bowl closing back onto it
  b: {
    adv: 64,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [...arc(32, -XH / 2, 22, 180, 540, 28)],
    ],
  },

  // c: `o`'s circle opened at the right, drawn the way a hand draws it —
  // starting upper-right and sweeping back over the top.
  c: { adv: 60, strokes: [[...arc(28, -XH / 2, 22, -45, -315, 26)]] },

  // f: hooked ascender + crossbar on the x-height line
  f: {
    adv: 44,
    strokes: [
      [...arc(30, -78, 14, 0, -180, 16), [16, 0]],
      [
        [4, -XH],
        [38, -XH],
      ],
    ],
  },

  // g: `d`'s bowl + a descending hook. Single-storey, to match the `a`.
  g: {
    adv: 64,
    strokes: [
      [...arc(24, -XH / 2, 22, -20, 340, 28)],
      [[46, -XH], [46, 18], ...arc(32, 18, 14, 0, 140, 14).slice(1)],
    ],
  },

  // h: ascender stem + shoulder. The shoulder arc lands ON the stem at 180deg
  // so the join is ink, not a near-miss the nib has to paper over.
  h: {
    adv: 60,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [...arc(30, -30, 20, 180, 360, 16), [50, 0]],
    ],
  },

  // i: stem + tittle. The tittle is a 2-point segment, not a point: a
  // 1-point polyline is dropped by `layoutWord` (`stroke.length < 2`), so a
  // dot has to be a stroke with length, and the nib makes it round.
  //
  // ⚠ THE TITTLE SITS AT -78, NOT AT -72, AND THE SIX UNITS ARE MEASURED.
  // `_probe-font-legibility.mjs` reads the gap between the tittle and the stem
  // as the tightest feature in the glyph: at -72 the clearance is 20 units, the
  // nib at the hero's own weight is 17.5, and the dot welded onto the stem at
  // R 0.198 — barely past the shipped 0.175, i.e. an `i` that turns into an `l`
  // on a slightly longer word. At -78 the clearance is 26 and the glyph clears
  // the `e`, which is the letterform that should be setting the font's floor.
  i: {
    adv: 30,
    strokes: [
      [
        [12, -XH],
        [12, 0],
      ],
      [
        [12, -80],
        [12, -78],
      ],
    ],
  },

  j: {
    adv: 44,
    strokes: [
      [
        [30, -80],
        [30, -78],
      ],
      [[30, -XH], [30, 18], ...arc(18, 18, 12, 0, 140, 12).slice(1)],
    ],
  },

  // m: stem + two shoulders, each arc starting on the previous stroke's foot
  m: {
    adv: 84,
    strokes: [
      [
        [10, -XH],
        [10, 0],
      ],
      [...arc(26, -34, 16, 180, 360, 14), [42, 0]],
      [...arc(58, -34, 16, 180, 360, 14), [74, 0]],
    ],
  },

  n: {
    adv: 60,
    strokes: [
      [
        [10, -XH],
        [10, 0],
      ],
      [...arc(30, -32, 20, 180, 360, 16), [50, 0]],
    ],
  },

  p: {
    adv: 64,
    strokes: [
      [
        [10, -XH],
        [10, 34],
      ],
      [...arc(32, -XH / 2, 22, 180, 540, 28)],
    ],
  },

  q: {
    adv: 64,
    strokes: [
      [...arc(24, -XH / 2, 22, -20, 340, 28)],
      [
        [46, -XH],
        [46, 34],
      ],
    ],
  },

  // r: `n`'s shoulder cut short — the arm stops before it turns down
  r: {
    adv: 42,
    strokes: [
      [
        [10, -XH],
        [10, 0],
      ],
      [...arc(28, -34, 18, 180, 300, 12)],
    ],
  },

  t: {
    adv: 42,
    strokes: [
      [
        [20, -84],
        [20, 0],
      ],
      [
        [6, -XH],
        [36, -XH],
      ],
    ],
  },

  // u: `n` turned over. Left stem + bowl in one stroke, then the right stem —
  // two strokes rather than one retraced path, so no ink is laid twice.
  u: {
    adv: 60,
    strokes: [
      [[10, -XH], [10, -20], ...arc(30, -20, 20, 180, 0, 16).slice(1)],
      [
        [50, -XH],
        [50, 0],
      ],
    ],
  },

  v: {
    adv: 60,
    strokes: [
      [
        [8, -XH],
        [30, 0],
        [52, -XH],
      ],
    ],
  },

  w: {
    adv: 80,
    strokes: [
      [
        [6, -XH],
        [22, 0],
        [38, -XH],
        [54, 0],
        [70, -XH],
      ],
    ],
  },

  x: {
    adv: 56,
    strokes: [
      [
        [8, -XH],
        [48, 0],
      ],
      [
        [48, -XH],
        [8, 0],
      ],
    ],
  },

  // y: the long diagonal passes through the short one's foot, so the junction
  // is a real crossing rather than two strokes ending near each other.
  y: {
    adv: 60,
    strokes: [
      [
        [8, -XH],
        [30, -2],
      ],
      [
        [52, -XH],
        [16, 34],
      ],
    ],
  },

  z: {
    adv: 58,
    strokes: [
      [
        [8, -XH],
        [48, -XH],
        [8, 0],
        [50, 0],
      ],
    ],
  },

  // ---- uppercase ---------------------------------------------------------

  A: {
    adv: 68,
    strokes: [
      [
        [6, 0],
        [34, -CAP],
        [62, 0],
      ],
      [
        [17, -39],
        [51, -39],
      ],
    ],
  },

  B: {
    adv: 68,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [[10, -CAP], ...arc(28, -75, 25, -90, 90, 18).slice(1), [10, -50]],
      [[10, -50], ...arc(30, -25, 25, -90, 90, 18).slice(1), [10, 0]],
    ],
  },

  C: { adv: 80, strokes: [[...arc(38, -50, 30, -45, -315, 26)]] },

  E: {
    adv: 68,
    strokes: [
      [
        [56, -CAP],
        [8, -CAP],
        [8, 0],
        [56, 0],
      ],
      [
        [8, -50],
        [46, -50],
      ],
    ],
  },

  F: {
    adv: 62,
    strokes: [
      [
        [56, -CAP],
        [8, -CAP],
        [8, 0],
      ],
      [
        [8, -50],
        [46, -50],
      ],
    ],
  },

  // G: `C`, then the bar that closes it. Drawn as two strokes because a hand
  // lifts there.
  G: {
    adv: 82,
    strokes: [
      [...arc(38, -50, 30, -45, -315, 26)],
      [
        [59, -29],
        [59, -50],
        [36, -50],
      ],
    ],
  },

  H: {
    adv: 72,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [
        [58, -CAP],
        [58, 0],
      ],
      [
        [10, -50],
        [58, -50],
      ],
    ],
  },

  I: {
    adv: 32,
    strokes: [
      [
        [12, -CAP],
        [12, 0],
      ],
    ],
  },

  J: {
    adv: 60,
    strokes: [[[46, -CAP], [46, -16], ...arc(30, -16, 16, 0, 145, 14).slice(1)]],
  },

  // K: the same three-stroke construction as the lowercase `k`, at cap height.
  K: {
    adv: 70,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [
        [58, -CAP],
        [10, -48],
      ],
      [
        [26, -66],
        [60, 0],
      ],
    ],
  },

  L: {
    adv: 62,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
        [54, 0],
      ],
    ],
  },

  M: {
    adv: 84,
    strokes: [
      [
        [8, 0],
        [8, -CAP],
        [40, -42],
        [72, -CAP],
        [72, 0],
      ],
    ],
  },

  N: {
    adv: 72,
    strokes: [
      [
        [8, 0],
        [8, -CAP],
        [60, 0],
        [60, -CAP],
      ],
    ],
  },

  O: { adv: 84, strokes: [[...arc(40, -50, 32, -90, 271, 32)]] },

  P: {
    adv: 68,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [[10, -CAP], ...arc(30, -74, 26, -90, 90, 18).slice(1), [10, -48]],
    ],
  },

  Q: {
    adv: 84,
    strokes: [
      [...arc(40, -50, 32, -90, 271, 32)],
      [
        [50, -24],
        [74, 6],
      ],
    ],
  },

  R: {
    adv: 72,
    strokes: [
      [
        [10, -CAP],
        [10, 0],
      ],
      [[10, -CAP], ...arc(30, -74, 26, -90, 90, 18).slice(1), [10, -48]],
      [
        [32, -48],
        [62, 0],
      ],
    ],
  },

  // S: the lowercase `s` scaled to cap height — same two-circle construction,
  // same shared junction at the waist (r 24, centres -74 and -26 meet at -50).
  S: {
    adv: 74,
    strokes: [
      [...arc(36, -74, 24, -45, -270, 20), ...arc(36, -26, 24, -90, 135, 20).slice(1)],
    ],
  },

  T: {
    adv: 72,
    strokes: [
      [
        [8, -CAP],
        [64, -CAP],
      ],
      [
        [36, -CAP],
        [36, 0],
      ],
    ],
  },

  U: {
    adv: 80,
    strokes: [
      [[10, -CAP], [10, -28], ...arc(38, -28, 28, 180, 0, 20).slice(1)],
      [
        [66, -CAP],
        [66, -28],
      ],
    ],
  },

  V: {
    adv: 76,
    strokes: [
      [
        [8, -CAP],
        [38, 0],
        [68, -CAP],
      ],
    ],
  },

  W: {
    adv: 100,
    strokes: [
      [
        [6, -CAP],
        [26, 0],
        [46, -CAP],
        [66, 0],
        [86, -CAP],
      ],
    ],
  },

  X: {
    adv: 72,
    strokes: [
      [
        [10, -CAP],
        [62, 0],
      ],
      [
        [62, -CAP],
        [10, 0],
      ],
    ],
  },

  Y: {
    adv: 72,
    strokes: [
      [
        [10, -CAP],
        [36, -52],
        [62, -CAP],
      ],
      [
        [36, -52],
        [36, 0],
      ],
    ],
  },

  Z: {
    adv: 74,
    strokes: [
      [
        [10, -CAP],
        [62, -CAP],
        [10, 0],
        [64, 0],
      ],
    ],
  },

  // ---- digits ------------------------------------------------------------
  // Cap height, so they set with the uppercase.

  0: { adv: 68, strokes: [[...arc(32, -50, 24, -90, 271, 30)]] },

  1: {
    adv: 52,
    strokes: [
      [
        [12, -80],
        [30, -CAP],
        [30, 0],
      ],
    ],
  },

  // 2: over the top (the arc runs 180 -> 410, INCREASING, so it sweeps through
  // 270 = up; running it decreasing would dive through the bottom instead and
  // draw a mirror of the digit).
  2: {
    adv: 68,
    strokes: [[...arc(30, -74, 24, 180, 410, 16), [8, 0], [58, 0]]],
  },

  3: {
    adv: 68,
    strokes: [[...arc(30, -74, 24, 180, 410, 16), ...arc(30, -26, 24, -50, 140, 16)]],
  },

  4: {
    adv: 70,
    strokes: [
      [
        [46, -CAP],
        [8, -32],
        [62, -32],
      ],
      [
        [46, -58],
        [46, 0],
      ],
    ],
  },

  5: {
    adv: 68,
    strokes: [[[58, -CAP], [16, -CAP], [14, -52], ...arc(34, -28, 24, -150, 140, 22).slice(1)]],
  },

  6: {
    adv: 68,
    strokes: [[[52, -96], [14, -42], ...arc(32, -26, 24, 180, 540, 26).slice(1)]],
  },

  7: {
    adv: 66,
    strokes: [
      [
        [8, -CAP],
        [62, -CAP],
        [26, 0],
      ],
    ],
  },

  // 8: two circles tangent at the waist — the centrelines TOUCH at (32,-50),
  // so the join is ink at every scale rather than a gap the nib bridges only
  // while the word is large.
  8: {
    adv: 68,
    strokes: [[...arc(32, -73, 23, -90, 270, 24)], [...arc(32, -27, 23, -90, 270, 24)]],
  },

  9: {
    adv: 68,
    strokes: [
      [...arc(32, -74, 24, -20, 340, 26)],
      [
        [56, -74],
        [56, -32],
        [18, -2],
      ],
    ],
  },

  // ---- punctuation -------------------------------------------------------
  // Dots are 2-point segments for the same reason the `i`'s tittle is.

  ".": { adv: 28, strokes: [[[10, -4], [10, -2]]] },
  ",": { adv: 28, strokes: [[[12, -6], [5, 14]]] },
  ":": { adv: 28, strokes: [[[10, -40], [10, -38]], [[10, -4], [10, -2]]] },
  ";": { adv: 28, strokes: [[[10, -40], [10, -38]], [[12, -6], [5, 14]]] },
  "!": { adv: 30, strokes: [[[12, -CAP], [12, -28]], [[12, -4], [12, -2]]] },
  "?": {
    adv: 58,
    strokes: [
      [...arc(28, -76, 20, 180, 400, 16), [30, -42], [30, -28]],
      [
        [30, -4],
        [30, -2],
      ],
    ],
  },
  "'": { adv: 24, strokes: [[[11, -CAP], [8, -74]]] },
  '"': { adv: 40, strokes: [[[11, -CAP], [8, -74]], [[27, -CAP], [24, -74]]] },
  "-": { adv: 48, strokes: [[[7, -40], [41, -40]]] },
  "–": { adv: 58, strokes: [[[6, -40], [52, -40]]] }, // en dash
  "—": { adv: 76, strokes: [[[6, -40], [70, -40]]] }, // em dash
  _: { adv: 56, strokes: [[[4, 10], [52, 10]]] },
  "/": { adv: 52, strokes: [[[8, 4], [44, -104]]] },
  "\\": { adv: 52, strokes: [[[8, -104], [44, 4]]] },
  "|": { adv: 28, strokes: [[[13, -104], [13, 10]]] },
  // Parentheses are wide, shallow arcs — a 62px radius through a 34px advance,
  // which is what keeps them reading as a bracket rather than as a `(`-shaped
  // letter `c`.
  "(": { adv: 34, strokes: [[...arc(68, -42, 62, 140, 220, 16)]] },
  ")": { adv: 34, strokes: [[...arc(-34, -42, 62, -40, 40, 16)]] },
  "[": { adv: 40, strokes: [[[34, -CAP], [10, -CAP], [10, 10], [34, 10]]] },
  "]": { adv: 40, strokes: [[[8, -CAP], [32, -CAP], [32, 10], [8, 10]]] },
  "{": {
    adv: 40,
    strokes: [[[34, -CAP], [22, -96], [22, -52], [10, -45], [22, -38], [22, 6], [34, 10]]],
  },
  "}": {
    adv: 40,
    strokes: [[[8, -CAP], [20, -96], [20, -52], [32, -45], [20, -38], [20, 6], [8, 10]]],
  },
  "<": { adv: 56, strokes: [[[44, -78], [10, -42], [44, -6]]] },
  ">": { adv: 56, strokes: [[[12, -78], [46, -42], [12, -6]]] },
  "=": { adv: 58, strokes: [[[8, -56], [50, -56]], [[8, -28], [50, -28]]] },
  "+": { adv: 58, strokes: [[[8, -42], [50, -42]], [[29, -63], [29, -21]]] },
  "*": {
    adv: 48,
    strokes: [[[24, -92], [24, -56]], [[8, -83], [40, -65]], [[40, -83], [8, -65]]],
  },
  "#": {
    adv: 64,
    strokes: [
      [[20, -92], [10, -8]],
      [[46, -92], [36, -8]],
      [[8, -64], [54, -64]],
      [[5, -36], [51, -36]],
    ],
  },
  // % — the two rings are r 16, not r 13. At 13 their counters were the
  // tightest feature in the whole font (they closed at R 0.177, one percent
  // above the weight the hero already renders at), so the glyph would have
  // been a pair of dots on any word at all. Measured, not eyeballed.
  "%": {
    adv: 80,
    strokes: [
      [...arc(21, -78, 16, -90, 271, 20)],
      [...arc(57, -22, 16, -90, 271, 20)],
      [[6, 0], [72, -CAP]],
    ],
  },
  "^": { adv: 56, strokes: [[[8, -64], [28, -96], [48, -64]]] },
  "~": {
    adv: 60,
    strokes: [[...arc(17, -40, 10, 180, 360, 10), ...arc(37, -40, 10, 180, 0, 10).slice(1)]],
  },
  "`": { adv: 24, strokes: [[[7, -CAP], [19, -82]]] },
  // & — top loop, the diagonal down-left, the bottom bowl swept under, and the
  // tail out to the lower right. One pen path, which is how it is written.
  "&": {
    adv: 78,
    strokes: [
      [
        ...arc(36, -78, 16, 200, 380, 14),
        [20, -34],
        ...arc(36, -34, 18, 180, 20, 14).slice(1),
        [70, -6],
      ],
    ],
  },
  // @ — inner bowl, outer ring opened at the lower right, and the inner tail.
  "@": {
    adv: 92,
    strokes: [
      [...arc(44, -50, 18, -20, 340, 26)],
      [...arc(44, -50, 36, -20, -290, 26)],
      [[62, -64], [62, -38], [76, -34]],
    ],
  },
  // $ — the cap-height S with the bar run through it, top and bottom clear.
  $: {
    adv: 74,
    strokes: [
      [...arc(36, -74, 24, -45, -270, 20), ...arc(36, -26, 24, -90, 135, 20).slice(1)],
      [
        [36, -110],
        [36, 12],
      ],
    ],
  },
}

/**
 * EVERY CHARACTER THE FONT CAN DRAW, as one string.
 *
 * `letters.d.ts` has declared this export since the file was written; the font
 * never had it, so the declaration was a promise about a value that did not
 * exist. It exists now, and the UI uses it to tell the user which characters it
 * cannot draw rather than dropping them in silence — the failure mode that made
 * a seven-glyph font look like a rendering bug for a whole session.
 */
export const SUPPORTED = Object.keys(GLYPHS).sort().join("")

/**
 * FOLD A CHARACTER THE FONT DOES NOT HAVE ONTO ONE IT DOES.
 *
 * Two classes, both of which used to advance as blank space:
 *
 *  1. **Accented Latin** — `café`, `Zürich`, `piñata`. NFD splits the letter
 *     from its combining mark, so dropping the U+0300..U+036F block leaves the
 *     ASCII base. Losing the accent is a visible compromise; losing the LETTER
 *     is a hole in the word, and this font has no accent marks to draw.
 *  2. **Typographic punctuation** — the quotes a text field or a paste from a
 *     word processor actually produces. `’` is what a Mac types when you press
 *     the apostrophe key under Smart Quotes, so the un-foldable version of this
 *     font could not draw the apostrophe in "don't".
 *
 * Returns `null` when nothing maps, which is what `SUPPORTED` reports on and
 * what the panel surfaces.
 */
const FOLD = {
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "…": ".",
  " ": " ",
  "\t": " ",
  "\n": " ",
  "\r": " ",
}

export function fold(ch) {
  if (Object.prototype.hasOwnProperty.call(GLYPHS, ch)) return ch
  const mapped = FOLD[ch]
  if (mapped !== undefined) return mapped
  const stripped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (stripped.length === 1 && Object.prototype.hasOwnProperty.call(GLYPHS, stripped)) {
    return stripped
  }
  return null
}

/**
 * ONE LINE, laid out from `x`, baseline at `y`. The body of this function is
 * the whole of what `layoutWord` used to be, moved out unchanged so the
 * single-line result is arithmetically identical to the shipped one — see the
 * note on `layoutWord` about why that identity is load-bearing.
 *
 * `letterFrom` continues the letter numbering across a wrapped block, so
 * `letterOf` stays dense and in reading order over the whole text rather than
 * restarting at every line break.
 */
function layoutLine(text, x, y, s, tracking, letterFrom = 0) {
  let penX = x
  const polylines = []
  // WHICH LETTER EACH POLYLINE BELONGS TO, parallel to `polylines`.
  //
  // The grouping was always here — this function walks the word glyph by glyph —
  // it just was not returned, so every consumer downstream saw a flat list of
  // strokes and had no way back to the letters. That is what made per-letter
  // animation look like it needed geometry analysis when it only needed this
  // array. Spaces and unknown characters do not take an index: they draw
  // nothing, and a letter slot that renders no ink is a hole in every per-letter
  // stagger that indexes into it.
  //
  // Additive: `polylines`, `width` and `height` are unchanged, so every existing
  // caller is byte-identical.
  const letterOf = []
  let letter = letterFrom
  for (const ch of text) {
    /* `fold` first, so `é` draws an `e` and a smart apostrophe draws an
     * apostrophe. It returns the character unchanged when the font has it, so
     * every ASCII character takes exactly the path it took before. */
    const key = fold(ch)
    const g = key === null ? undefined : GLYPHS[key]
    if (!g) {
      penX += 46 * s + tracking
      continue
    }
    let drew = false
    for (const stroke of g.strokes) {
      if (stroke.length < 2) continue
      polylines.push(stroke.map(([gx, gy]) => ({ x: penX + gx * s, y: y + gy * s })))
      letterOf.push(letter)
      drew = true
    }
    if (drew) letter++
    penX += g.adv * s + tracking
  }
  return { polylines, letterOf, letterCount: letter, width: penX - x }
}

/** The advance a run of text takes, without building any geometry. */
function advanceOf(text, s, tracking) {
  let w = 0
  for (const ch of text) {
    const key = fold(ch)
    const g = key === null ? undefined : GLYPHS[key]
    w += (g ? g.adv : 46) * s + tracking
  }
  return w
}

/**
 * Lay out text into absolute polylines.
 *
 * ── THE SINGLE-LINE RESULT IS BYTE-IDENTICAL TO THE SHIPPED ONE ─────────────
 *
 * "Desk Doodles" is the hero word and `logo-strokes.json`'s stand-in, and the
 * film, the letter map, the carve register and eight assertions are all
 * calibrated against the exact floats it produces. So `maxWidth` is opt-in, the
 * unwrapped path runs the original arithmetic in `layoutLine` untouched, and
 * the wrap only engages once the text is genuinely wider than the page it is
 * being written on. `layoutWord("Desk Doodles", …)` returns the same numbers it
 * returned before this file grew.
 *
 * `maxWidth` is in the SAME units as the returned `width` (i.e. already scaled
 * by `size`), because that is the unit the caller is thinking in when it says
 * "the word may not be wider than the page".
 */
export function layoutWord(
  text,
  { x = 0, y = 0, size = 120, tracking = 10, maxWidth = 0, lineGap = 1.62 } = {},
) {
  const s = size / CAP
  const first = layoutLine(text, x, y, s, tracking)
  const lineHeight = size * lineGap

  // No wrap asked for, or it already fits: the original return, plus the two
  // block facts a caller needs to centre it.
  if (!(maxWidth > 0) || first.width <= maxWidth) {
    return { ...first, width: first.width, height: size, lineCount: 1, lineHeight }
  }

  /* ---- GREEDY WRAP ON WORD BOUNDARIES ------------------------------------
   * Greedy and not Knuth-Plass on purpose: this is a hero mark of a few words,
   * where the thing that matters is that no line runs off the frame, and a
   * paragraph optimiser would be a second layout engine to keep honest for a
   * difference nobody can see at three lines.
   *
   * A single word longer than the page is broken mid-word rather than allowed
   * to overflow — the alternative is a line that silently leaves the frame,
   * which is the failure this whole change exists to remove. */
  const words = text.split(/(\s+)/).filter((t) => t.length > 0)
  const lines = []
  let cur = ""
  const pushCur = () => {
    // Trailing whitespace carries advance but draws nothing; dropping it keeps
    // the measured line width equal to the width of the ink on it.
    const trimmed = cur.replace(/\s+$/, "")
    if (trimmed.length > 0) lines.push(trimmed)
    cur = ""
  }
  for (const tok of words) {
    if (/^\s+$/.test(tok)) {
      if (cur.length > 0) cur += tok
      continue
    }
    const candidate = cur + tok
    if (cur.length > 0 && advanceOf(candidate, s, tracking) > maxWidth) {
      pushCur()
      cur = tok
    } else {
      cur = candidate
    }
    // Hard-break a word that cannot fit on a line of its own.
    while (advanceOf(cur, s, tracking) > maxWidth && [...cur].length > 1) {
      const chars = [...cur]
      let head = ""
      for (const c of chars) {
        if (head.length > 0 && advanceOf(head + c, s, tracking) > maxWidth) break
        head += c
      }
      if (head.length === 0 || head.length === chars.length) break
      lines.push(head)
      cur = chars.slice([...head].length).join("")
    }
  }
  pushCur()
  if (lines.length === 0) return { ...first, width: first.width, height: size, lineCount: 1, lineHeight }

  /* Laid twice: once to learn the widths, once to CENTRE each line inside the
   * widest one. A hero mark is a shape before it is a sentence, and a ragged
   * left edge reads as a bug in a thing this size — the block has to sit under
   * the camera as a block. (The single-line path never reaches here, so the
   * centring cannot perturb "Desk Doodles".) */
  const widths = lines.map((line) => advanceOf(line, s, tracking))
  const width = widths.reduce((a, b) => (b > a ? b : a), 0)

  const polylines = []
  const letterOf = []
  let letter = 0
  lines.forEach((line, i) => {
    const laid = layoutLine(line, x + (width - widths[i]) / 2, y + i * lineHeight, s, tracking, letter)
    polylines.push(...laid.polylines)
    letterOf.push(...laid.letterOf)
    letter = laid.letterCount
  })

  return {
    polylines,
    letterOf,
    letterCount: letter,
    width,
    height: (lines.length - 1) * lineHeight + size,
    lineCount: lines.length,
    lineHeight,
  }
}

export function measureWord(text, opts = {}) {
  return layoutWord(text, opts).width
}
