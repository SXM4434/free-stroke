// Builds docs/storyboard/breakdowns.png — the sheet the board was missing:
// the passing positions and the frame-by-frame exposure sheet.
//
// Panel A is REAL FOOTAGE, not a diagram: the original flip's own turn frames,
// re-extracted with alpha and composited over the paper, cropped to the word.
// Panel B is the spacing chart in the traditional notation (keys circled,
// breakdown underlined) with the measured 87% vs 42% placement. Panel C is the
// 267-frame exposure sheet in the director's shorthand.
//
// Usage: node docs/storyboard/tools/breakdowns.mjs <frames-dir>
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

const SRC = process.argv[2]
const OUT = join(process.cwd(), "docs", "storyboard", "breakdowns.png")

const PAPER = "#E9B44C"
const INK = "#1a1a1a"
const BG = "#faf7f0"
const RED = "#c0392b"
const GRN = "#1e7a4c"
const BLU = "#1f4e8c"
const GREY = "#8b8378"

const W = 1960
const H = 1136
const c = createCanvas(W, H)
const x = c.getContext("2d")
x.fillStyle = BG
x.fillRect(0, 0, W, H)

const txt = (s, px, py, { size = 13, col = INK, weight = "", align = "left", font = "Helvetica" } = {}) => {
  x.fillStyle = col
  x.font = `${weight} ${size}px ${font}`.trim()
  x.textAlign = align
  x.fillText(s, px, py)
  x.textAlign = "left"
}

/** Word-wrap to a pixel width; returns the y after the last line. */
const wrap = (s, px, py, maxW, o = {}) => {
  const size = o.size ?? 11.5
  x.font = `${o.weight ?? ""} ${size}px Helvetica`.trim()
  let y = py
  for (const para of s.split("\n")) {
    let line = ""
    for (const w of para.split(" ")) {
      const test = line ? line + " " + w : w
      if (x.measureText(test).width > maxW && line) {
        txt(line, px, y, o)
        y += size + 3
        line = w
      } else line = test
    }
    if (line) { txt(line, px, y, o); y += size + 3 }
  }
  return y
}

/* ---- title --------------------------------------------------------------- */
txt("THE BREAKDOWNS — where the passing position actually sits", 28, 44, { size: 27, weight: "bold" })
txt(
  "The drawing between two keys decides the character of the move, and it is not the midpoint. Panel A is real footage from the original flip; B is the measured spacing; C is the sheet.",
  28, 68, { size: 13, col: "#5a5248" },
)

/* ---- PANEL A — the moment, in real frames -------------------------------- */
const PICKS = [
  { f: 152, w: 473, note: "commit — still readable" },
  { f: 153, w: 269, note: "past half width" },
  { f: 154, w: 28, note: "THE EDGE", moment: true },
  { f: 155, w: 28, note: "held — frame 2 of 2", moment: true },
  { f: 156, w: 476, note: "the other face is there" },
]

const AY = 96
const CW = 366
const CH = 100
const GAP = 12
const SX0 = 28

txt("A — THE MOMENT, IN THE ORIGINAL'S OWN FRAMES", SX0, AY + 16, { size: 15, weight: "bold" })
txt(
  "desk-doodles-traced.webm, re-extracted with alpha, composited over the paper. Same crop, same scale. Widths measured at native 1920 (full word = 820 px).",
  SX0, AY + 36, { size: 12, col: "#5a5248" },
)

const cropped = []
for (const p of PICKS) {
  const img = await loadImage(join(SRC, String(p.f).padStart(4, "0") + ".png"))
  const t = createCanvas(880, 240)
  const tc = t.getContext("2d")
  tc.fillStyle = PAPER
  tc.fillRect(0, 0, 880, 240)
  tc.drawImage(img, 519, 418, 880, 240, 0, 0, 880, 240)
  cropped.push(t)
}

const AT = AY + 68
cropped.forEach((t, i) => {
  const px = SX0 + i * (CW + GAP)
  const p = PICKS[i]
  x.drawImage(t, px, AT, CW, CH)
  x.strokeStyle = p.moment ? GRN : "#d8d0c2"
  x.lineWidth = p.moment ? 3 : 1
  x.strokeRect(px + 0.5, AT + 0.5, CW - 1, CH - 1)

  // header strip
  x.fillStyle = p.moment ? GRN : "#3b3630"
  x.fillRect(px, AT - 20, CW, 20)
  txt(`f${p.f}   t=${(p.f / 30).toFixed(2)}s`, px + 8, AT - 6, { size: 11, col: "#fff", weight: "bold" })
  txt(`w = ${p.w} px`, px + CW - 8, AT - 6, { size: 11, col: "#fff", weight: "bold", align: "right" })

  txt(p.note, px + 2, AT + CH + 16, { size: 11.5, col: p.moment ? GRN : "#5a5248", weight: p.moment ? "bold" : "" })
})

// the step callout between f153 and f154
const stepX = SX0 + 2 * (CW + GAP) - GAP / 2
x.strokeStyle = RED
x.lineWidth = 2
x.beginPath()
x.moveTo(stepX, AT - 26)
x.lineTo(stepX, AT + CH + 24)
x.stroke()
txt("241 px of extent in ONE frame — and the centre moves 0.5 px.", SX0, AT + CH + 40, { size: 12.5, col: RED, weight: "bold" })
txt(
  "That single frame FAILS the current gate (maxWidthJump < 6 px) by forty times, and PASSES the registration clause (maxCentreJump < 4 px) with room to spare. The gate conflates the two.",
  SX0, AT + CH + 58, { size: 12, col: "#5a5248" },
)

/* ---- PANEL B — spacing charts -------------------------------------------- */
const BY = 350
txt("B — THE SPACING CHART", SX0, BY, { size: 15, weight: "bold" })
txt(
  "Traditional notation: keys are CIRCLED, the breakdown is UNDERLINED. Position of the half-way pose along the move is what decides whether it reads as an event or a fade.",
  SX0, BY + 20, { size: 12, col: "#5a5248" },
)

function ladder(px, py, w, label, sub, frac, col, marks) {
  txt(label, px, py - 10, { size: 13, weight: "bold", col })
  // the rail
  x.strokeStyle = "#3b3630"
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(px, py + 24)
  x.lineTo(px + w, py + 24)
  x.stroke()
  // even-spacing ghost
  x.strokeStyle = "#d8d0c2"
  x.lineWidth = 1
  for (let i = 0; i <= 10; i++) {
    const gx = px + (i / 10) * w
    x.beginPath()
    x.moveTo(gx, py + 30)
    x.lineTo(gx, py + 38)
    x.stroke()
  }
  txt("even spacing (what the eye reads as mechanical)", px, py + 52, { size: 10.5, col: GREY })

  // the real marks
  for (const m of marks) {
    const mx = px + m.t * w
    x.strokeStyle = col
    x.lineWidth = 2
    x.beginPath()
    x.moveTo(mx, py + 12)
    x.lineTo(mx, py + 24)
    x.stroke()
  }
  // keys, circled
  for (const t of [0, 1]) {
    const kx = px + t * w
    x.strokeStyle = "#3b3630"
    x.lineWidth = 2
    x.beginPath()
    x.arc(kx, py + 24, 8, 0, Math.PI * 2)
    x.stroke()
    x.fillStyle = BG
    x.fill()
    x.stroke()
  }
  txt("KEY", px, py + 4, { size: 10, weight: "bold", align: "center" })
  txt("KEY", px + w, py + 4, { size: 10, weight: "bold", align: "center" })

  // the breakdown, underlined
  const bx = px + frac * w
  x.fillStyle = col
  x.beginPath()
  x.arc(bx, py + 24, 6, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = col
  x.lineWidth = 2.5
  x.beginPath()
  x.moveTo(bx - 16, py + 40)
  x.lineTo(bx + 16, py + 40)
  x.stroke()
  txt(`${Math.round(frac * 100)}%`, bx, py + 58, { size: 14, weight: "bold", col, align: "center" })
  txt("half-way pose", bx, py + 72, { size: 10.5, col, align: "center" })

  wrap(sub, px, py + 96, w, { size: 11.5, col: "#5a5248" })
}

const LW = 760
ladder(
  SX0, BY + 62, LW,
  "THE ORIGINAL FLIP — turn out (13 frames)",
  "sx = abs cos( easeInOutCubic(t) x 180deg ).  Solved: easeInOutCubic = 1/3 at t = 0.4368 -> frame 11.36 of 26  ->  86.9% of the face-out half.\nMeasured in the film: half width (410 of 820) falls at f152.3  ->  (152.3−141)/13 = 86.9%.  Slow readable commit, then a whip.",
  0.869, GRN,
  [{ t: 0.13 }, { t: 0.30 }, { t: 0.48 }, { t: 0.66 }, { t: 0.79 }, { t: 0.869 }, { t: 0.94 }, { t: 0.98 }],
)

ladder(
  SX0 + LW + 150, BY + 62, LW,
  "THE CURRENT BEAT — emerge (10 frames)",
  "Tonal range per frame: 1.98  ->  2.13  ->  2.67  ->  3.57  ->  4.44  ->  5.13  ->  5.37  ->  5.83  ->  6.35  ->  6.54.\nSpan 4.56; half-value 4.26 lands at frame 3.79 of 9  ->  42%.  Largest single-frame step 0.90 — nothing ever happens faster than 1/5 of the whole change.",
  0.42, RED,
  [{ t: 0.11 }, { t: 0.22 }, { t: 0.33 }, { t: 0.42 }, { t: 0.55 }, { t: 0.66 }, { t: 0.77 }, { t: 0.88 }],
)

// the verdict between them
x.fillStyle = "#f3ece0"
x.fillRect(SX0 + LW + 14, BY + 62, 122, 110)
x.strokeStyle = "#d8d0c2"
x.strokeRect(SX0 + LW + 14.5, BY + 62.5, 121, 109)
txt("87%", SX0 + LW + 75, BY + 96, { size: 22, weight: "bold", col: GRN, align: "center" })
txt("vs", SX0 + LW + 75, BY + 118, { size: 12, col: GREY, align: "center" })
txt("42%", SX0 + LW + 75, BY + 144, { size: 22, weight: "bold", col: RED, align: "center" })
txt("an event", SX0 + LW + 75, BY + 160, { size: 10, col: GREY, align: "center" })

/* ---- PANEL C — the exposure sheet ---------------------------------------- */
const CY = 596
txt("C — THE EXPOSURE SHEET", SX0, CY, { size: 15, weight: "bold" })
txt(
  "30 fps  ·  267 frames  ·  8.90s — the original's exact length.        NOTATION:  flat line = hold   ·   wave = action   ·   arch = anticipation   ·   cross = must happen on this exact frame.",
  SX0, CY + 20, { size: 12, col: "#5a5248" },
)

const ROWS = [
  { a: 0, b: 75, n: 76, lbl: "draw-in", note: "pen writes L-to-R, drawEase blend 0.45", kind: "act" },
  { a: 76, b: 89, n: 14, lbl: "K1  THE PEN LIFTS", note: "HELD — flat, dead-on. The framing everything is judged against.", kind: "hold" },
  { a: 90, b: 98, n: 9, lbl: "K2  TENSE", note: "compress f90-95 on easeOutStrong, then HOLD f96-98. scaleY .955 / scaleX 1.018", kind: "ant" },
  { a: 99, b: 103, n: 5, lbl: "turn out", note: "cos law; half width at f103.3 = 87% of the f98.5-f104.0 span; shade 0.35(1-sx)", kind: "act" },
  { a: 104, b: 105, n: 2, lbl: "* K3  THE EDGE", note: "sx clamped 0.035 - the TRUE edge, thickness only. Held on twos.", kind: "mom" },
  { a: 106, b: 110, n: 5, lbl: "turn in", note: "mirror; half width at f106.2 = 13% - EARLY, the cushion is on the far side", kind: "act" },
  { a: 111, b: 119, n: 9, lbl: "land + settle", note: "crossings resolve to over/under; contact shadow LANDS on its own curve, ~4f behind", kind: "act" },
  { a: 120, b: 137, n: 18, lbl: "K4  SOLID, HELD", note: "HELD at K1's exact framing. Camera stopped. The A/B frame.", kind: "hold" },
  { a: 138, b: 179, n: 42, lbl: "K5  THE RISE", note: "easeInOutBack; el 65>10deg, az 0>30deg, fill 1.0>0.86 · dip 70.5deg, overshoot 4.5deg", kind: "act" },
  { a: 180, b: 188, n: 9, lbl: "settle", note: "rock back to el 10deg", kind: "act" },
  { a: 189, b: 224, n: 36, lbl: "K6  THE 3/4 HOLD", note: "driftEase az 30>38deg -> zero velocity by f224, then STOPPED", kind: "hold" },
  { a: 225, b: 229, n: 5, lbl: "turn out", note: "", kind: "act" },
  { a: 230, b: 231, n: 2, lbl: "* THE EDGE (return)", note: "", kind: "mom" },
  { a: 232, b: 236, n: 5, lbl: "turn in", note: "", kind: "act" },
  { a: 237, b: 266, n: 30, lbl: "K7  HELD FLAT", note: "HELD at K1's framing. The round trip closes.", kind: "hold" },
]

const RH = 26
const RY = CY + 38
const COLF = 84
const COLT = 78
const COLN = 40
const COLS = 300
const STRIPX = SX0 + COLF + COLT + COLN + COLS + 24
const STRIPW = W - STRIPX - 28
const TOTAL = 267

// Fixed columns so a late row's note cannot run off the sheet: the strip is
// its own right-hand column, exactly as the camera column sits on a real
// X-sheet, rather than floating after the bar.
const GLYPHX = 542
const NOTEX = 574
const STRIP0 = 1286
const STRIPWID = W - STRIP0 - 28

txt("frames", SX0, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
txt("t (s)", SX0 + COLF, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
txt("n", SX0 + COLF + COLT, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
txt("shot / action", SX0 + COLF + COLT + COLN, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
txt("notation + what the frames do", GLYPHX, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
txt("where it falls in the 8.90s", STRIP0, RY - 8, { size: 10.5, col: GREY, weight: "bold" })
x.strokeStyle = "#d8d0c2"
x.lineWidth = 1
x.beginPath()
x.moveTo(STRIP0 - 14, RY - 22)
x.lineTo(STRIP0 - 14, RY + ROWS.length * RH)
x.stroke()

ROWS.forEach((r, i) => {
  const py = RY + i * RH
  const col = r.kind === "mom" ? GRN : r.kind === "hold" ? "#3b3630" : r.kind === "ant" ? BLU : "#b5651d"

  if (i % 2 === 0) {
    x.fillStyle = "#f3ece0"
    x.fillRect(SX0 - 6, py - 2, W - SX0 * 2 + 12, RH - 2)
  }
  // every 8th line ruled thicker, as a real X-sheet
  if (r.a % 8 < 3) {
    x.strokeStyle = "#e2d9c8"
    x.lineWidth = 1
    x.beginPath()
    x.moveTo(SX0 - 6, py - 2)
    x.lineTo(W - SX0 + 6, py - 2)
    x.stroke()
  }

  txt(`${r.a}–${r.b}`, SX0, py + 14, { size: 11.5, col: "#3b3630" })
  txt(`${(r.a / 30).toFixed(2)}–${(r.b / 30).toFixed(2)}`, SX0 + COLF, py + 14, { size: 11, col: GREY })
  txt(String(r.n), SX0 + COLF + COLT, py + 14, { size: 11.5, col: "#3b3630", weight: "bold" })
  txt(r.lbl, SX0 + COLF + COLT + COLN, py + 14, {
    size: 12, col, weight: r.kind === "mom" || r.kind === "hold" ? "bold" : "",
  })

  // the strip: position + width proportional to real time, in its own column
  const sx = STRIP0 + (r.a / TOTAL) * STRIPWID
  const sw = Math.max(3, (r.n / TOTAL) * STRIPWID)
  x.fillStyle = col
  if (r.kind === "mom") {
    x.fillRect(sx - 1, py + 1, Math.max(4, sw), RH - 8)
  } else {
    x.globalAlpha = r.kind === "hold" ? 1 : 0.55
    x.fillRect(sx, py + 5, sw, RH - 14)
    x.globalAlpha = 1
  }

  // shorthand glyph, fixed column
  const gx = GLYPHX
  x.strokeStyle = col
  x.lineWidth = 1.6
  if (r.kind === "hold") {
    x.beginPath(); x.moveTo(gx, py + 12); x.lineTo(gx + 16, py + 12); x.stroke()
  } else if (r.kind === "ant") {
    x.beginPath(); x.arc(gx + 8, py + 13, 6, Math.PI, 0); x.stroke()
  } else if (r.kind === "mom") {
    x.beginPath(); x.moveTo(gx, py + 6); x.lineTo(gx + 11, py + 18)
    x.moveTo(gx + 11, py + 6); x.lineTo(gx, py + 18); x.stroke()
  } else {
    x.beginPath(); x.moveTo(gx, py + 16)
    x.bezierCurveTo(gx + 5, py + 4, gx + 11, py + 22, gx + 16, py + 10); x.stroke()
  }
  if (r.note) txt(r.note, NOTEX, py + 16, { size: 10.5, col: "#5a5248" })
})

/* ---- footer -------------------------------------------------------------- */
const FY = RY + ROWS.length * RH + 22
x.fillStyle = "#f3ece0"
x.fillRect(SX0 - 6, FY - 16, W - SX0 * 2 + 12, 48)
txt(
  "HELD 14 + 18 + 36 + 30 = 98 frames = 37% of the runtime.        MOMENTS: f104–105 and f230–231 — TWO.        Current beat: 9% held, 0 moments, 9.82s.",
  SX0, FY + 4, { size: 12.5, weight: "bold" },
)
txt(
  "Two frames and not one: 33 ms reads as a dropped frame, 67 ms reads as a beat. The original holds its sliver on twos (f154 and f155 are byte-identical: ink 410, w 14, cx 479.5). " +
  "The turn is on twos only while the camera is parked; the rise is on ones, because it is a camera move.",
  SX0, FY + 24, { size: 11.5, col: "#5a5248" },
)

writeFileSync(OUT, c.toBuffer("image/png"))
console.log("wrote", OUT)
