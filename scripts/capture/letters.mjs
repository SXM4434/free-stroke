// Clean single-stroke vector font for the "Desk Doodles" capture.
// Coordinate space per glyph: x in [0..advance], y with baseline at y=0,
// cap top at y=-100, x-height top at y=-52, descender bottom at y=+34.
// Each glyph is an array of polylines (arrays of [x,y]); the letters draw in
// the order the polylines are listed, which the inflate reveal replays.

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
        [50, -XH / 2],
        [8, -XH / 2],
        ...arc(28, -XH / 2, 22, 180, 400, 30).slice(1),
      ],
    ],
  },

  // lowercase s: single continuous S curve (top bowl then bottom bowl)
  s: {
    adv: 50,
    strokes: [
      [
        ...arc(25, -XH * 0.72, 15, -30, 210, 20),
        ...arc(25, -XH * 0.26, 15, 30, 250, 20).slice(1),
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
      [[...arc(24, -XH / 2, 22, -20, 340, 28)]],
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
}

// Lay out a word into absolute polylines. Returns { polylines, width, height }.
// size = cap height in px. baselineY = y of baseline in output space.
export function layoutWord(text, { x = 0, y = 0, size = 120, tracking = 10 } = {}) {
  const s = size / CAP
  let penX = x
  const polylines = []
  for (const ch of text) {
    const g = GLYPHS[ch]
    if (!g) {
      penX += 46 * s + tracking
      continue
    }
    for (const stroke of g.strokes) {
      if (stroke.length < 2) continue
      polylines.push(stroke.map(([gx, gy]) => ({ x: penX + gx * s, y: y + gy * s })))
    }
    penX += g.adv * s + tracking
  }
  return { polylines, width: penX - x, height: size }
}

export function measureWord(text, opts = {}) {
  return layoutWord(text, opts).width
}
