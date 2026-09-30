#!/usr/bin/env node
/**
 * assert-flip-pose: the flip's pose law, moved out of lib/hero-motion.ts into
 * lib/flip-pose.ts by lane FLIP-1 on 2026-09-26, held to exactly what it was.
 *
 * FROZEN REFERENCE. `OLD` below is a copy of the old functions, cut from
 * lib/hero-motion.ts at 9df4eb486 (the commit before the move) and transpiled
 * to plain JS with the comments stripped. Never edit it. He approved this exact
 * curve, so a change to a number in the flip is a defect, and this gate going
 * red on one is the gate doing its job. The frozen turn paths `oldEmergeTurn`
 * and `oldReturnTurn` are copies of the same commit's `sampleEmerge` and
 * `sampleReturn`, cut down to the turn shapes ("shipped", "turnLands").
 *
 * Rows
 *   ID-LAW    every moved function equals its frozen copy, compared with
 *             Object.is, over a grid of inputs
 *   ID-FLIP   flipPoseAt equals the frozen turn paths, Object.is on every
 *             channel, at 2,001 evenly spaced clocks per case, plus both ends,
 *             every phase boundary and one float step either side of each
 *   ID-LIVE   flipPoseAt equals the lab's own live sampleEmerge and
 *             sampleReturn on DEFAULT_HERO_MOTION, shapes shipped and turnLands
 *   ONE-COPY  hero-motion.ts hands out flip-pose.ts's own function objects
 *   S-ENDS    the eased curves' endpoints, and both flips' first and last pose
 *   S-DWELL   exactly 2 frames on the edge at 30 fps at four frame phases, yaw
 *             exactly 90 deg, width under 5 %, the ink swapping across it
 *   S-MONO    the out-turn only turns out and the in-turn only turns back
 *   S-BREAK   the half-width pose lands at 85 to 89 % of the out-turn (plan
 *             section 2, B1's measured 87 %)
 *
 * Corpus: lib/flip-pose.ts, and sampleEmerge / sampleReturn in
 * lib/hero-motion.ts. Not covered: the viewport, the page, the lab page's
 * FlatState mapping, and `shadow`, which is FormState's own shadowLaw and not
 * part of the turn. Those are phase 2.
 *
 * Must-fails run through GATE_MUTATE_FILE, so nothing on disk changes. Exit 0
 * only when every row passes, every mutant turns its rows red, and every row is
 * named by at least one mutant.
 *
 *   node scripts/verify/assert-flip-pose.mjs
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const FP = "lib/flip-pose.ts"
const HM = "lib/hero-motion.ts"
const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })

/* ---- FROZEN: lib/hero-motion.ts at 9df4eb486, transpiled. Never edit. ---- */
const OLD = (() => {
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const DEG = Math.PI / 180;
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function cubicBezierEase(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = (a) => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return (t) => {
        const x = clamp01(t);
        if (x === 0 || x === 1)
            return x;
        let guess = x;
        for (let i = 0; i < 8; i++) {
            const d = slope(guess, x1, x2);
            if (d === 0)
                break;
            guess -= (calc(guess, x1, x2) - x) / d;
        }
        if (guess < 0 || guess > 1) {
            let lo = 0;
            let hi = 1;
            guess = x;
            for (let i = 0; i < 20; i++) {
                const v = calc(guess, x1, x2);
                if (Math.abs(v - x) < 1e-5)
                    break;
                if (v > x)
                    hi = guess;
                else
                    lo = guess;
                guess = (lo + hi) / 2;
            }
        }
        return calc(guess, y1, y2);
    };
}
const ddFlipEase = cubicBezierEase(0.45, 0, 0.2, 1);
function turnPhase(local, beatSec, dwellSec) {
    const dwell = Math.max(0, dwellSec);
    const turnSec = Math.max(1e-6, beatSec - dwell);
    const halfTurn = turnSec / 2;
    let u;
    let inDwell = false;
    if (local < halfTurn) {
        u = local / turnSec;
    }
    else if (local < halfTurn + dwell) {
        u = 0.5;
        inDwell = true;
    }
    else {
        u = (local - dwell) / turnSec;
    }
    return { u: clamp01(u), inDwell, turnSec, halfTurn, dwell };
}
function turnPose(u, e, landYawRad = 0, reverse = false) {
    const angle = easeInOutCubic(u) * Math.PI;
    const half = Math.PI / 2;
    if (!(landYawRad > 0)) {
        const sx = Math.max(Math.abs(Math.cos(angle)), e.edgeFloor);
        return { angle, sx, shade: e.turnShade * (1 - sx), yaw: angle <= half ? angle : Math.PI - angle };
    }
    const outward = angle <= half;
    const t = outward ? angle / half : (angle - half) / half;
    const yaw = reverse
        ? outward
            ? landYawRad + (half - landYawRad) * t
            : half - half * t
        : outward
            ? half * t
            : half - (half - landYawRad) * t;
    const sx = Math.max(Math.abs(Math.cos(yaw)), e.edgeFloor);
    return { angle, sx, shade: e.turnShade * (1 - sx), yaw };
}
function solidDepthAt(yaw, landRad, flatDepth) {
    const c = Math.cos(yaw);
    const cl = Math.cos(landRad);
    const w = Math.min(1, (c * c) / (cl * cl));
    const s2 = Math.sin(yaw) ** 2;
    const edge = SOLID_EDGE_DEPTH * s2 * s2 * s2 * s2;
    return flatDepth + (1 - flatDepth) * Math.max(w, edge);
}
const SOLID_EDGE_DEPTH = 0.5;
const THIN_SOLID_SHADE = 0.28;
function solidShade(shade, depth) {
    const t = 1 - depth;
    return shade + THIN_SOLID_SHADE * t * t * t * t;
}
return { clamp01, DEG, easeInOutCubic, cubicBezierEase, ddFlipEase, turnPhase, turnPose, solidDepthAt, SOLID_EDGE_DEPTH, THIN_SOLID_SHADE, solidShade }
})()

const oldLandYawOf = (p) => (p.shape === "turnLands" || p.shape === "solidFirst" ? Math.max(0, p.landYaw) * OLD.DEG : 0)
const oldLandedPose = (p) => {
  const yaw = oldLandYawOf(p)
  return { flat: 0, depth: 1, yaw, shade: 0, sx: Math.abs(Math.cos(yaw)) }
}
// sampleEmerge at 9df4eb486, emerge.mode "turn", shapes shipped / turnLands.
function oldEmergeTurn(p, start, tSec) {
  const e = p.emerge
  const local = tSec - start
  if (local <= 0) return { flat: 1, depth: e.flatDepth, yaw: 0, shade: 0, sx: 1 }
  if (local >= p.beats.emerge) return oldLandedPose(p)
  const { u, inDwell } = OLD.turnPhase(local, p.beats.emerge, e.dwellSec)
  const landRad = oldLandYawOf(p)
  const { sx, shade, yaw } = OLD.turnPose(u, e, landRad)
  const flat = u < 0.5 ? 1 : 0
  const depth = flat ? e.flatDepth : OLD.solidDepthAt(yaw, landRad, e.flatDepth)
  if (inDwell) {
    const edgeDepth = OLD.solidDepthAt(Math.PI / 2, landRad, e.flatDepth)
    return { flat: 0, depth: edgeDepth, yaw: Math.PI / 2, shade: OLD.solidShade(e.turnShade * (1 - e.edgeFloor), edgeDepth), sx: e.edgeFloor }
  }
  return { flat, depth, yaw, shade: flat ? shade : OLD.solidShade(shade, depth), sx }
}
// sampleReturn at 9df4eb486, ret.mode not "prior", shapes shipped / turnLands.
function oldReturnTurn(p, start, tSec) {
  const e = p.emerge
  const beat = p.beats.returnTurn
  const local = tSec - start
  if (local <= 0) return { ...oldLandedPose(p), jointBreak: 0 }
  if (local >= beat) return { flat: 1, depth: e.flatDepth, yaw: 0, shade: 0, sx: 1 }
  const { u, inDwell } = OLD.turnPhase(local, beat, e.dwellSec)
  const { sx, shade, yaw } = OLD.turnPose(u, e, oldLandYawOf(p), true)
  if (inDwell) {
    const edgeDepth = OLD.solidDepthAt(Math.PI / 2, oldLandYawOf(p), e.flatDepth)
    return { flat: 0, depth: edgeDepth, yaw: Math.PI / 2, shade: OLD.solidShade(e.turnShade * (1 - e.edgeFloor), edgeDepth), sx: e.edgeFloor }
  }
  const past = u >= 0.5
  const depth = past ? e.flatDepth : OLD.solidDepthAt(yaw, oldLandYawOf(p), e.flatDepth)
  return { flat: past ? 1 : 0, depth, yaw, shade: past ? shade : OLD.solidShade(shade, depth), sx }
}

/* ---- helpers ------------------------------------------------------------- */
const N = 2000 // intervals, so 2,001 clocks
const KEYS = ["ink", "depth", "yaw", "shade", "sx"]
const DIRS = ["flatToSolid", "solidToFlat"]
const deg = (r) => ((r * 180) / Math.PI).toFixed(3)
const f64 = new Float64Array(1)
const u64 = new BigUint64Array(f64.buffer)
function step(x, dir) {
  if (x === 0) return dir > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE
  f64[0] = x
  u64[0] += x > 0 === dir > 0 ? 1n : -1n
  return f64[0]
}
const landsOf = (p) => (p.shape === "turnLands" || p.shape === "solidFirst" ? p.landYaw : 0)
function optsFor(p, dir, start) {
  return {
    on: true,
    direction: dir,
    startSec: start,
    beatSec: dir === "flatToSolid" ? p.beats.emerge : p.beats.returnTurn,
    dwellSec: p.emerge.dwellSec,
    landYaw: landsOf(p),
    flatDepth: p.emerge.flatDepth,
    turnShade: p.emerge.turnShade,
    edgeFloor: p.emerge.edgeFloor,
  }
}
const geom = (o) => {
  const d = Math.max(0, o.dwellSec)
  return { s: o.startSec, b: o.beatSec, d, half: Math.max(1e-6, o.beatSec - d) / 2 }
}
function clocksFor(o) {
  const { s, b, d, half } = geom(o)
  const out = []
  for (let i = 0; i <= N; i++) out.push(s + (b * i) / N)
  for (const t of [s, s + half, s + half + d, s + b]) out.push(t, step(t, -1), step(t, 1))
  out.push(s - 0.25, s + b + 0.25)
  return out
}
function stretchOf(o, t) {
  const { s, b, d, half } = geom(o)
  const l = t - s
  return l <= 0 ? "before" : l >= b ? "after" : l < half ? "out" : l < half + d ? "dwell" : "in"
}

/* ---- rows ---------------------------------------------------------------- */
async function runRows() {
  const F = loadTs(FP)
  const H = loadTs(HM)
  const P0 = H.DEFAULT_HERO_MOTION
  // Force the turn paths on, so a default that parks the turn cannot pass by skipping it.
  const base = { ...P0, emerge: { ...P0.emerge, mode: "turn" }, ret: { ...P0.ret, mode: P0.ret.mode === "prior" ? "identical" : P0.ret.mode } }
  const shapes = [{ ...base, shape: "shipped" }, { ...base, shape: "turnLands" }]
  const look = { turnShade: base.emerge.turnShade, edgeFloor: base.emerge.edgeFloor }

  // ID-LAW
  {
    let n = 0
    const bad = []
    const cmp = (name, a, b) => {
      n++
      if (!Object.is(a, b) && bad.length < 4) bad.push(`${name}: ${a} vs ${b}`)
      else if (!Object.is(a, b)) bad.push("")
    }
    const us = [0, 0.5, 1]
    for (let i = 0; i <= N; i++) us.push(-0.1 + (1.2 * i) / N)
    const lands = [0, 38 * OLD.DEG, base.landYaw * OLD.DEG, 60 * OLD.DEG]
    for (const u of us) {
      cmp(`easeInOutCubic(${u})`, F.easeInOutCubic(u), OLD.easeInOutCubic(u))
      cmp(`ddFlipEase(${u})`, F.ddFlipEase(u), OLD.ddFlipEase(u))
      cmp(`clamp01(${u})`, F.clamp01(u), OLD.clamp01(u))
      for (const land of lands) {
        for (const rev of [false, true]) {
          const a = F.turnPose(u, look, land, rev)
          const b = OLD.turnPose(u, look, land, rev)
          for (const k of ["angle", "sx", "shade", "yaw"]) cmp(`turnPose(${u},${deg(land)},${rev}).${k}`, a[k], b[k])
        }
      }
    }
    for (const [beat, dwell] of [[base.beats.emerge, base.emerge.dwellSec], [base.beats.returnTurn, base.emerge.dwellSec], [18 / 30, 2 / 30], [0.5, 0], [0.4, -0.1]]) {
      const half = Math.max(1e-6, beat - Math.max(0, dwell)) / 2
      const ls = [0, half, half + Math.max(0, dwell), beat]
      for (const t of [...ls]) ls.push(step(t, -1), step(t, 1))
      for (let i = 0; i <= N; i++) ls.push(-0.1 + ((beat + 0.2) * i) / N)
      for (const l of ls) {
        const a = F.turnPhase(l, beat, dwell)
        const b = OLD.turnPhase(l, beat, dwell)
        for (const k of ["u", "inDwell", "turnSec", "halfTurn", "dwell"]) cmp(`turnPhase(${l},${beat},${dwell}).${k}`, a[k], b[k])
      }
    }
    for (let i = 0; i <= 400; i++) {
      const yaw = (Math.PI / 2) * (i / 400)
      for (const land of lands) for (const fd of [0.08, base.emerge.flatDepth, 0]) cmp(`solidDepthAt(${yaw},${land},${fd})`, F.solidDepthAt(yaw, land, fd), OLD.solidDepthAt(yaw, land, fd))
    }
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) cmp(`solidShade(${i / 40},${j / 40})`, F.solidShade(i / 40, j / 40), OLD.solidShade(i / 40, j / 40))
    const cbA = F.cubicBezierEase(0.25, 0.1, 0.25, 1)
    const cbB = OLD.cubicBezierEase(0.25, 0.1, 0.25, 1)
    for (let i = 0; i <= N; i++) cmp(`cubicBezierEase(ease)(${i / N})`, cbA(i / N), cbB(i / N))
    cmp("DEG", F.DEG, OLD.DEG)
    cmp("SOLID_EDGE_DEPTH", F.SOLID_EDGE_DEPTH, OLD.SOLID_EDGE_DEPTH)
    cmp("THIN_SOLID_SHADE", F.THIN_SOLID_SHADE, OLD.THIN_SOLID_SHADE)
    row("ID-LAW", bad.length === 0 && n > 100000, "every moved function equals its frozen copy, exact (Object.is)", `${n - bad.length} of ${n} values identical${bad.length ? `; ${bad.length} differ, first: ${bad.filter(Boolean).join(" | ")}` : ""}`)
  }

  // ID-FLIP
  {
    let n = 0
    let cases = 0
    const bad = []
    const cover = []
    for (const p of shapes) {
      for (const timing of ["default", "plan18"]) {
        const q = timing === "default" ? p : { ...p, beats: { ...p.beats, emerge: 18 / 30, returnTurn: 18 / 30 }, emerge: { ...p.emerge, dwellSec: 2 / 30 } }
        const off = H.phaseOffsets(p)
        for (const dir of DIRS) {
          const start = timing === "plan18" ? 0 : dir === "flatToSolid" ? off.emerge : off.returnTurn
          const o = optsFor(q, dir, start)
          const seen = { before: 0, out: 0, dwell: 0, in: 0, after: 0 }
          cases++
          for (const t of clocksFor(o)) {
            const a = F.flipPoseAt(t, o)
            const r = dir === "flatToSolid" ? oldEmergeTurn(q, start, t) : oldReturnTurn(q, start, t)
            const b = { ...r, ink: r.flat }
            seen[stretchOf(o, t)]++
            for (const k of KEYS) {
              n++
              if (!Object.is(a[k], b[k])) bad.push(`${p.shape}/${timing}/${dir} t=${t} ${k}: ${a[k]} vs ${b[k]}`)
            }
          }
          const missing = Object.entries(seen).filter(([, c]) => c === 0).map(([k]) => k)
          cover.push(`${p.shape}/${timing}/${dir} ${Object.values(seen).join("/")}${missing.length ? ` MISSING ${missing}` : ""}`)
          if (missing.length) bad.push(`${p.shape}/${timing}/${dir} never reached: ${missing}`)
        }
      }
    }
    const off = F.flipPoseAt(1, { ...optsFor(shapes[0], "flatToSolid", 0), on: false })
    if (off !== null) bad.push(`flip off returned ${JSON.stringify(off)}, not null`)
    row("ID-FLIP", bad.length === 0, "flipPoseAt equals the frozen sampleEmerge/sampleReturn turn paths, exact, 2,001 clocks per case plus ends and boundaries", `${n - bad.length} of ${n} channel values identical over ${cases} cases; samples before/out/dwell/in/after: ${cover.join("; ")}${bad.length ? `; FIRST: ${bad.slice(0, 3).join(" | ")}` : ""}`)
  }

  // ID-LIVE
  {
    let n = 0
    const bad = []
    for (const p of shapes) {
      const off = H.phaseOffsets(p)
      for (const dir of DIRS) {
        const start = dir === "flatToSolid" ? off.emerge : off.returnTurn
        const o = optsFor(p, dir, start)
        for (const t of clocksFor(o)) {
          const a = F.flipPoseAt(t, o)
          const r = dir === "flatToSolid" ? H.sampleEmerge(p, t) : H.sampleReturn(p, t)
          const b = { ...r, ink: r.flat }
          for (const k of KEYS) {
            n++
            if (!Object.is(a[k], b[k])) bad.push(`${p.shape}/${dir} t=${t} ${k}: ${a[k]} vs ${b[k]}`)
          }
        }
      }
    }
    row("ID-LIVE", bad.length === 0, "flipPoseAt equals the lab's live sampleEmerge and sampleReturn (DEFAULT_HERO_MOTION, shipped and turnLands)", `${n - bad.length} of ${n} channel values identical${bad.length ? `; FIRST: ${bad.slice(0, 3).join(" | ")}` : ""}`)
  }

  // ONE-COPY
  {
    const names = ["easeInOutCubic", "cubicBezierEase", "ddFlipEase"]
    const same = names.filter((k) => typeof H[k] === "function" && H[k] === F[k])
    row("ONE-COPY", same.length === names.length, "hero-motion.ts re-exports flip-pose.ts's own function objects, not copies", `${same.length} of ${names.length} identical objects (${same.join(", ") || "none"})`)
  }

  // S-ENDS
  {
    const bad = []
    const e0 = F.easeInOutCubic(0), e1 = F.easeInOutCubic(1), d0 = F.ddFlipEase(0), d1 = F.ddFlipEase(1)
    if (e0 !== 0 || e1 !== 1) bad.push(`easeInOutCubic ends ${e0}, ${e1}`)
    if (Math.abs(d0) > 1e-6 || Math.abs(d1 - 1) > 1e-6) bad.push(`ddFlipEase ends ${d0}, ${d1}`)
    const notes = []
    for (const p of shapes) {
      const off = H.phaseOffsets(p)
      const land = Math.max(0, landsOf(p)) * F.DEG
      for (const dir of DIRS) {
        const o = optsFor(p, dir, dir === "flatToSolid" ? off.emerge : off.returnTurn)
        const { s, b } = geom(o)
        const first = F.flipPoseAt(s, o)
        const last = F.flipPoseAt(s + b, o)
        const nearly = F.flipPoseAt(s + b * (1 - 1e-6), o)
        const drawing = { ink: 1, depth: o.flatDepth, yaw: 0, sx: 1 }
        const solid = { ink: 0, depth: 1, yaw: land, sx: Math.abs(Math.cos(land)) }
        const [want0, want1] = dir === "flatToSolid" ? [drawing, solid] : [solid, drawing]
        for (const k of Object.keys(want0)) if (!Object.is(first[k], want0[k])) bad.push(`${p.shape}/${dir} first ${k} ${first[k]} want ${want0[k]}`)
        for (const k of Object.keys(want1)) if (!Object.is(last[k], want1[k])) bad.push(`${p.shape}/${dir} last ${k} ${last[k]} want ${want1[k]}`)
        if (nearly.ink !== want1.ink || Math.abs(nearly.yaw - want1.yaw) > 1e-3 || Math.abs(nearly.sx - want1.sx) > 1e-3) bad.push(`${p.shape}/${dir} jumps at the end: yaw ${deg(nearly.yaw)} to ${deg(want1.yaw)}, ink ${nearly.ink} to ${want1.ink}`)
        notes.push(`${p.shape}/${dir}: yaw ${deg(first.yaw)} to ${deg(last.yaw)} deg, ink ${first.ink} to ${last.ink}, depth ${first.depth} to ${last.depth}`)
      }
    }
    row("S-ENDS", bad.length === 0, "the curves start at 0 and end at 1; each flip starts and ends on its resting pose with no jump", `easeInOutCubic(0,1) = ${e0}, ${e1}; ddFlipEase(0,1) = ${d0}, ${d1}; ${notes.join("; ")}${bad.length ? `; BAD: ${bad.slice(0, 3).join(" | ")}` : ""}`)
  }

  // S-DWELL
  {
    const bad = []
    const want = Math.round(base.emerge.dwellSec * 30)
    let runs = 0
    for (const p of shapes) {
      const off = H.phaseOffsets(p)
      for (const dir of DIRS) {
        const o = optsFor(p, dir, dir === "flatToSolid" ? off.emerge : off.returnTurn)
        const { s, b } = geom(o)
        for (const phi of [0, 0.25, 0.5, 0.75]) {
          runs++
          const frames = []
          for (let k = -5; k <= Math.ceil(b * 30) + 5; k++) frames.push(F.flipPoseAt(s + (k + phi) / 30, o))
          const idx = frames.map((f, i) => (f.inDwell ? i : -1)).filter((i) => i >= 0)
          const tag = `${p.shape}/${dir}/phase ${phi}`
          if (idx.length !== want) bad.push(`${tag}: ${idx.length} dwell frames, want ${want}`)
          if (idx.length && idx[idx.length - 1] - idx[0] !== idx.length - 1) bad.push(`${tag}: dwell frames not consecutive`)
          for (const i of idx) {
            const f = frames[i]
            if (f.yaw !== Math.PI / 2) bad.push(`${tag}: dwell yaw ${deg(f.yaw)}`)
            if (!(f.sx < 0.05)) bad.push(`${tag}: dwell width ${f.sx}`)
            for (const k of KEYS) if (!Object.is(f[k], frames[idx[0]][k])) bad.push(`${tag}: dwell frames differ in ${k}`)
          }
          if (idx.length) {
            const before = frames.slice(0, idx[0]).map((f) => f.ink)
            const after = frames.slice(idx[idx.length - 1] + 1).map((f) => f.ink)
            const [wb, wa] = dir === "flatToSolid" ? [1, 0] : [0, 1]
            if (before.some((x) => x !== wb)) bad.push(`${tag}: ink before the edge is not ${wb}`)
            if (after.some((x) => x !== wa)) bad.push(`${tag}: ink after the edge is not ${wa}`)
          }
        }
      }
    }
    row("S-DWELL", bad.length === 0, `exactly ${want} frames on the edge at 30 fps, yaw exactly 90 deg, width under 5 %, ink swaps across it`, `${runs} runs (2 shapes x 2 directions x 4 frame phases); dwellSec ${base.emerge.dwellSec} = ${base.emerge.dwellSec * 30} frames; edge width ${base.emerge.edgeFloor}${bad.length ? `; BAD: ${bad.slice(0, 3).join(" | ")}` : ""}`)
  }

  // S-MONO
  {
    const bad = []
    const notes = []
    for (const p of shapes) {
      const off = H.phaseOffsets(p)
      for (const dir of DIRS) {
        const o = optsFor(p, dir, dir === "flatToSolid" ? off.emerge : off.returnTurn)
        const { s, b } = geom(o)
        const all = []
        for (let i = 0; i <= N; i++) all.push(s + (b * i) / N)
        const tag = `${p.shape}/${dir}`
        for (const part of ["out", "in"]) {
          const fs = all.filter((t) => stretchOf(o, t) === part).map((t) => F.flipPoseAt(t, o))
          if (fs.length < 100) bad.push(`${tag} ${part}: only ${fs.length} samples`)
          const ink = dir === "flatToSolid" ? (part === "out" ? 1 : 0) : part === "out" ? 0 : 1
          let yawBad = 0, sxBad = 0, inkBad = 0
          for (let i = 1; i < fs.length; i++) {
            const dy = fs[i].yaw - fs[i - 1].yaw
            const dx = fs[i].sx - fs[i - 1].sx
            if (part === "out" ? !(dy > 0) : !(dy < 0)) yawBad++
            if (part === "out" ? dx > 0 : dx < 0) sxBad++
          }
          for (const f of fs) if (f.ink !== ink) inkBad++
          if (yawBad || sxBad || inkBad) bad.push(`${tag} ${part}: ${yawBad} yaw steps the wrong way, ${sxBad} width steps, ${inkBad} ink`)
          if (fs.length) notes.push(`${tag} ${part} ${fs.length} samples yaw ${deg(fs[0].yaw)} to ${deg(fs[fs.length - 1].yaw)}`)
        }
      }
    }
    row("S-MONO", bad.length === 0, "out-turn: yaw strictly rises, width never grows; in-turn: yaw strictly falls, width never shrinks; ink constant on each", `${notes.join("; ")}${bad.length ? `; BAD: ${bad.slice(0, 3).join(" | ")}` : ""}`)
  }

  // S-BREAK
  {
    const bad = []
    const notes = []
    for (const p of shapes) {
      const off = H.phaseOffsets(p)
      const o = optsFor(p, "flatToSolid", off.emerge)
      const { s, half } = geom(o)
      let lo = 0, hi = half
      for (let i = 0; i < 80; i++) {
        const m = (lo + hi) / 2
        if (F.flipPoseAt(s + m, o).sx > 0.5) lo = m
        else hi = m
      }
      const at = hi / half
      if (!(at >= 0.85 && at <= 0.89)) bad.push(`${p.shape}: half-width pose at ${(at * 100).toFixed(2)} %`)
      notes.push(`${p.shape}: ${(at * 100).toFixed(2)} % of the out-turn`)
    }
    // For the record, not asserted: the plan credits the 87 % to ddFlipEase, but the turn runs on
    // easeInOutCubic. Where the half-width pose would land if the angle ran on ddFlipEase instead:
    let lo = 0, hi = 1
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2
      if (F.ddFlipEase(m) < 1 / 3) lo = m
      else hi = m
    }
    notes.push(`on ddFlipEase it would be ${((hi / 0.5) * 100).toFixed(2)} % (not asserted)`)
    row("S-BREAK", bad.length === 0, "the half-width pose (width 0.5, yaw 60 deg) lands at 85 to 89 % of the out-turn", `${notes.join("; ")}${bad.length ? `; BAD: ${bad.join(" | ")}` : ""}`)
  }
}

/* ---- must-fails ---------------------------------------------------------- */
const MUTANTS = [
  { name: "turn ease constant +0.01 (easeInOutCubic 4 to 4.01)", file: FP, find: "  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2", text: "  t < 0.5 ? 4.01 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2", red: ["ID-LAW", "ID-FLIP"] },
  { name: "flip curve control point +0.01 (ddFlipEase 0.45 to 0.46)", file: FP, find: "export const ddFlipEase = cubicBezierEase(0.45, 0, 0.2, 1)", text: "export const ddFlipEase = cubicBezierEase(0.46, 0, 0.2, 1)", red: ["ID-LAW"] },
  { name: "dwell ends 1 frame late", file: FP, find: "  } else if (local < halfTurn + dwell) {", text: "  } else if (local < halfTurn + dwell + 1 / 30) {", red: ["ID-LAW", "ID-FLIP", "S-DWELL"] },
  { name: "dwell starts 1 frame early", file: FP, find: "  if (local < halfTurn) {", text: "  if (local < halfTurn - 1 / 30) {", red: ["ID-LAW", "ID-FLIP", "S-DWELL"] },
  { name: "sign flipped: in-turn clock adds the dwell", file: FP, find: "    u = (local - dwell) / turnSec", text: "    u = (local + dwell) / turnSec", red: ["ID-LAW", "ID-FLIP"] },
  { name: "sign flipped: the return's in-turn yaw", file: FP, find: "      : half - half * t //", text: "      : half + half * t //", red: ["ID-LAW", "ID-FLIP", "S-MONO"] },
  { name: "return runs the out-turn's segment order", file: FP, find: "  const { sx, shade, yaw } = turnPose(u, o, landRad, true)", text: "  const { sx, shade, yaw } = turnPose(u, o, landRad, false)", red: ["ID-FLIP", "ID-LIVE"] },
  { name: "flip lands at the flat card's depth", file: FP, find: "    if (local >= beat) return { ink: 0, depth: 1,", text: "    if (local >= beat) return { ink: 0, depth: o.flatDepth,", red: ["ID-FLIP", "ID-LIVE", "S-ENDS"] },
  { name: "linear turn, the plan's F3 must-fail", file: FP, find: "  const angle = easeInOutCubic(u) * Math.PI", text: "  const angle = u * Math.PI", red: ["ID-LAW", "ID-FLIP", "S-BREAK"] },
  { name: "hero-motion.ts stops handing out flip-pose's own ddFlipEase", file: HM, find: 'export { easeInOutCubic, cubicBezierEase, ddFlipEase } from "./flip-pose"', text: 'export { easeInOutCubic, cubicBezierEase } from "./flip-pose"\nexport const ddFlipEase2 = 0', red: ["ONE-COPY"] },
]

function editFor(src, file, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-flip-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: [editFor(src, m.file, m.find, m.text)] }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) {
        note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      } else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        caught = red.length === m.red.length
        note = `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
      }
    } catch (e) {
      note = `mutant could not be built: ${e.message}`
    }
    out.push({ ...m, caught, note })
  }
  rmSync(dir, { recursive: true, force: true })
  return out
}

/* ---- main ---------------------------------------------------------------- */
try {
  await runRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(9)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && rows.length >= 8 && caught === muts.length && unguarded.length === 0 ? 0 : 1)
