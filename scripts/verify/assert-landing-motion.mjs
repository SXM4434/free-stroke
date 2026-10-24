#!/usr/bin/env node
/**
 * assert-landing-motion: the per-stroke transform after a stroke lands
 * (lib/landing-motion.ts, PERSTROKE 2026-10-02). Plan section 3d and coverage
 * item 9: each effect starts at the landing, ends at rest, and peaks where it
 * says it does, on numbers read from the lab and the register, never retyped.
 *
 * Rows
 *   SP-START    spring: the landing pose is DESK_DOODLES.motion.settleFrom (0.92), held before it
 *   SP-PEAK     spring: 1.015 +- 0.003 at 62 % of its length, and that is its highest point (plan SP1)
 *   SP-REST     spring: exactly 1 at the end and after, and within 1e-4 of 1 one ms before
 *   SP-REDUCED  spring under reduced motion is 1 at every moment (plan SP1's second half)
 *   SP-REUSE    spring defaults are DESK_DOODLES.motion's own numbers and its curve is the register's ease string
 *   SE-START    settle: lands at the lab's popScale, about the contact, held before it
 *   SE-PEAK     settle: furthest from rest at the landing, and it never passes rest
 *   SE-REST     settle: exactly 1 at the end and after
 *   SE-REUSE    settle is the lab's pop-in, popScale + (1 - popScale) * easeOutStrong(u), Object.is
 *   WO-START    wobble: 0 at the landing and before, and moving right after
 *   WO-PEAK     wobble: its largest swing is in the first quarter cycle, 0.7 to 1.0 of the amount
 *   WO-REST     wobble: exactly 0 at the end, within 1e-3 deg one ms before
 *   PU-START    pulse: 1 at the landing and before, and rising right after
 *   PU-PEAK     pulse: 1 + amount at style-clock's attack, scaled to the length, and that is its highest point
 *   PU-REST     pulse: exactly 1 at the end, within 1e-4 one ms before (no cutoff drop)
 *   PU-REUSE    pulse is style-clock's pulseEnvelope lifted off its cutoff, at 400 moments
 *   STAGGER     starts: tied landings ripple staggerMs apart, spaced landings keep their own times
 *   PIVOT       poseOffset holds the pivot still for 200 poses, and rest is exactly 0
 *   REACH       firstReach finds the first crossing of a curve with flats, to 1e-9
 *   UNITS       mesh keys map to strokes per engine, fused meshes to the mark, clipped lists through pieces
 *   OFF         Off and a zero amount are rest at every moment and need no tail
 *   PRESET      Completion Pulse is implemented and its take carries a pulse on the whole mark,
 *               and Customize lists the landing's five fields under it
 *   SESSION     a stored landing comes back, a bad one is turned off and named, none stays none
 *
 * Must-fails run through GATE_MUTATE_FILE, so nothing on disk changes. Exit 0
 * only when every row passes, every mutant turns its rows red, and every row
 * is named by at least one mutant.
 *
 *   node scripts/verify/assert-landing-motion.mjs
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const LM = "lib/landing-motion.ts"
const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })

const MS = 1 / 1000
const grid = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n))

async function runRows() {
  const L = loadTs(LM)
  const R = loadTs("lib/registers.ts")
  const HM = loadTs("lib/hero-motion.ts")
  const SC = loadTs("lib/style-clock.ts")
  const FP = loadTs("lib/flip-pose.ts")
  const dd = R.DESK_DOODLES.motion

  /* ---- spring ---- */
  {
    const p = L.landingFor("spring")
    const at = (t) => L.landingPose(p, t).scale
    const s0 = at(0)
    const before = [at(-1), at(-0.05), at(-1e-9)]
    row("SP-START", Math.abs(s0 - dd.settleFrom) < 1e-12 && before.every((v) => v === s0) && at(MS) > s0,
      "spring: the landing pose is DESK_DOODLES.motion.settleFrom, held before, rising after",
      `at 0 ${s0.toFixed(6)} (settleFrom ${dd.settleFrom}); before ${before.map((v) => v.toFixed(4)).join(", ")}; 1 ms after ${at(MS).toFixed(6)}`)
    const tPeak = 0.62 * p.durationSec
    const sPeak = at(tPeak)
    const samples = grid(4000, (f) => ({ t: f * p.durationSec, s: at(f * p.durationSec) }))
    const top = samples.reduce((m, x) => (x.s > m.s ? x : m))
    row("SP-PEAK", Math.abs(sPeak - 1.015) <= 0.003 && Math.abs(top.t - tPeak) <= p.durationSec / 4000 + 1e-12 && top.s <= sPeak + 1e-12,
      "spring: 1.015 +- 0.003 at 62 % of its length, and that is its highest point",
      `at ${(tPeak * 1000).toFixed(1)} ms ${sPeak.toFixed(6)}; highest ${top.s.toFixed(6)} at ${(top.t * 1000).toFixed(2)} ms`)
    const end = at(p.durationSec)
    const after = [at(p.durationSec + MS), at(10)]
    const near = at(p.durationSec - MS)
    row("SP-REST", end === 1 && after.every((v) => v === 1) && Math.abs(near - 1) < 1e-4 && L.landingPose(p, p.durationSec).rotZ === 0,
      "spring: exactly 1 at the end and after, within 1e-4 one ms before",
      `end ${end}; after ${after.join(", ")}; 1 ms before ${near.toFixed(7)}`)
    const red = grid(400, (f) => L.landingPose(p, -0.1 + f * (p.durationSec + 0.2), true).scale)
    row("SP-REDUCED", red.every((v) => v === 1), "spring under reduced motion is 1 at every moment",
      `401 moments from -100 ms to the end + 100 ms; not 1: ${red.filter((v) => v !== 1).length}`)
    const ease = FP.cubicBezierEase(0.22, 1, 0.36, 1)
    const easeSame = grid(200, (f) => Object.is(L.ddLandEase(f), ease(f))).every(Boolean)
    const d = L.LANDING_EFFECT_DEFAULTS.spring
    row("SP-REUSE",
      Object.is(d.amount, 1 - dd.settleFrom) && Object.is(d.durationSec, dd.settleMs / 1000) && Object.is(d.staggerMs, dd.staggerMs) &&
        dd.ease === "cubic-bezier(0.22, 1, 0.36, 1)" && easeSame,
      "spring defaults are DESK_DOODLES.motion's own numbers and its curve is the register's ease string",
      `amount ${d.amount} = 1 - ${dd.settleFrom}; ${d.durationSec} s = ${dd.settleMs} ms; stagger ${d.staggerMs} = ${dd.staggerMs}; ease "${dd.ease}" equal on 201 points: ${easeSame}`)
  }

  /* ---- settle ---- */
  {
    const p = L.landingFor("settle")
    const hm = HM.DEFAULT_HERO_MOTION
    const q0 = L.landingPose(p, 0)
    const before = [L.landingPose(p, -1), L.landingPose(p, -1e-9)]
    row("SE-START", Math.abs(q0.scale - hm.popScale) < 1e-12 && q0.pivot === "contact" && before.every((q) => q.scale === q0.scale && q.pivot === "contact") && L.landingPose(p, MS).scale > q0.scale,
      "settle: lands at the lab's popScale about the contact, held before, rising after",
      `at 0 ${q0.scale.toFixed(6)} (popScale ${hm.popScale}) about ${q0.pivot}; before ${before.map((q) => `${q.scale.toFixed(4)}/${q.pivot}`).join(", ")}`)
    const s = grid(2000, (f) => L.landingPose(p, f * p.durationSec).scale)
    const dev = s.map((v) => Math.abs(1 - v))
    const maxAt = dev.indexOf(Math.max(...dev))
    const mono = s.every((v, i) => i === 0 || v >= s[i - 1] - 1e-15)
    row("SE-PEAK", maxAt === 0 && mono && s.every((v) => v <= 1),
      "settle: furthest from rest at the landing, and it never passes rest",
      `largest deviation at sample ${maxAt} of 2001; monotone ${mono}; highest ${Math.max(...s).toFixed(9)}`)
    const end = L.landingPose(p, p.durationSec).scale
    row("SE-REST", end === 1 && L.landingPose(p, 5).scale === 1 && Math.abs(L.landingPose(p, p.durationSec - MS).scale - 1) < 1e-4,
      "settle: exactly 1 at the end and after", `end ${end}; 1 ms before ${L.landingPose(p, p.durationSec - MS).scale.toFixed(8)}`)
    let bad = 0
    for (let i = 0; i < 400; i++) {
      const u = i / 400
      const want = hm.popScale + (1 - hm.popScale) * HM.easeOutStrong(u)
      if (Math.abs(L.landingPose(p, u * p.durationSec).scale - want) > 1e-12) bad++
    }
    row("SE-REUSE", bad === 0 && Object.is(p.durationSec, hm.popSettleSec) && Object.is(p.amount, 1 - hm.popScale),
      "settle is the lab's pop-in on its own length", `400 moments off the pop-in by more than 1e-12: ${bad}; length ${p.durationSec} s = popSettleSec ${hm.popSettleSec}`)
  }

  /* ---- wobble ---- */
  {
    const p = L.landingFor("wobble")
    const rot = (t) => L.landingPose(p, t).rotZ / (Math.PI / 180)
    row("WO-START", rot(0) === 0 && rot(-1) === 0 && rot(-1e-9) === 0 && Math.abs(rot(MS)) > 1e-4,
      "wobble: 0 at the landing and before, and moving right after", `at 0 ${rot(0)}; 1 ms after ${rot(MS).toFixed(5)} deg`)
    const samples = grid(4000, (f) => ({ t: f * p.durationSec, r: Math.abs(rot(f * p.durationSec)) }))
    const top = samples.reduce((m, x) => (x.r > m.r ? x : m))
    const quarter = L.landingPeakSec(p)
    row("WO-PEAK", top.t > 0 && top.t <= quarter + 1e-12 && top.r >= 0.7 * p.amount && top.r <= p.amount,
      "wobble: its largest swing is in the first quarter cycle, 0.7 to 1.0 of the amount",
      `largest ${top.r.toFixed(4)} deg of ${p.amount} at ${(top.t * 1000).toFixed(1)} ms; quarter cycle ${(quarter * 1000).toFixed(1)} ms`)
    row("WO-REST", rot(p.durationSec) === 0 && rot(9) === 0 && Math.abs(rot(p.durationSec - MS)) < 1e-3,
      "wobble: exactly 0 at the end, within 1e-3 deg one ms before", `end ${rot(p.durationSec)}; 1 ms before ${rot(p.durationSec - MS).toExponential(3)} deg`)
  }

  /* ---- pulse ---- */
  {
    const p = L.landingFor("pulse")
    const at = (t) => L.landingPose(p, t).scale
    row("PU-START", at(0) === 1 && at(-1) === 1 && at(5 * MS) > 1,
      "pulse: 1 at the landing and before, and rising right after", `at 0 ${at(0)}; 5 ms after ${at(5 * MS).toFixed(6)}`)
    const tPeak = (SC.PULSE_ATTACK_SECONDS / SC.PULSE_LIFETIME) * p.durationSec
    const samples = grid(8000, (f) => ({ t: f * p.durationSec, s: at(f * p.durationSec) }))
    const top = samples.reduce((m, x) => (x.s > m.s ? x : m))
    row("PU-PEAK",
      Math.abs(at(tPeak) - (1 + p.amount)) < 1e-9 && Math.abs(top.t - tPeak) <= p.durationSec / 8000 + 1e-12 && Math.abs(L.landingPeakSec(p) - tPeak) < 1e-12,
      "pulse: 1 + amount at style-clock's attack, scaled to the length, and that is its highest point",
      `at ${(tPeak * 1000).toFixed(1)} ms ${at(tPeak).toFixed(6)} (want ${1 + p.amount}); highest at ${(top.t * 1000).toFixed(2)} ms`)
    const near = at(p.durationSec - MS)
    row("PU-REST", at(p.durationSec) === 1 && at(30) === 1 && Math.abs(near - 1) < 1e-4,
      "pulse: exactly 1 at the end, within 1e-4 one ms before", `end ${at(p.durationSec)}; 1 ms before ${near.toFixed(7)}`)
    let bad = 0
    for (let i = 0; i < 400; i++) {
      const u = i / 400
      const env = SC.pulseEnvelope(u * SC.PULSE_LIFETIME)
      const want = 1 + p.amount * Math.max(0, (env - SC.PULSE_CUTOFF) / (1 - SC.PULSE_CUTOFF))
      if (Math.abs(at(u * p.durationSec) - want) > 1e-12) bad++
    }
    row("PU-REUSE", bad === 0 && Object.is(p.durationSec, SC.PULSE_LIFETIME),
      "pulse is style-clock's pulseEnvelope lifted off its cutoff", `400 moments off by more than 1e-12: ${bad}; default length = PULSE_LIFETIME ${SC.PULSE_LIFETIME.toFixed(4)} s`)
  }

  /* ---- starts ---- */
  {
    const a = L.landingStarts([1000, 1000, 1000, 1000], 50)
    const b = L.landingStarts([0, 400, 900, 2000], 50)
    const c = L.landingStarts([900, 100, 100], 50)
    const okA = [1000, 1050, 1100, 1150].every((v, i) => a[i] === v)
    const okB = [0, 400, 900, 2000].every((v, i) => b[i] === v)
    const okC = c[1] === 100 && c[2] === 150 && c[0] === 900
    row("STAGGER", okA && okB && okC, "starts: tied landings ripple staggerMs apart, spaced landings keep their own times",
      `tied ${Array.from(a).join(", ")}; spaced ${Array.from(b).join(", ")}; out of order ${Array.from(c).join(", ")}`)
  }

  /* ---- pivot ---- */
  {
    let worst = 0
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) {
      const q = { scale: 0.7 + 0.6 * rnd(), rotZ: (rnd() - 0.5) * 0.6, pivot: "centre" }
      const pv = [(rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5)]
      const [tx, ty, tz] = L.poseOffset(q, pv)
      const c = Math.cos(q.rotZ)
      const s = Math.sin(q.rotZ)
      const x = tx + q.scale * (c * pv[0] - s * pv[1])
      const y = ty + q.scale * (s * pv[0] + c * pv[1])
      const z = tz + q.scale * pv[2]
      worst = Math.max(worst, Math.abs(x - pv[0]), Math.abs(y - pv[1]), Math.abs(z - pv[2]))
    }
    const rest = L.poseOffset(L.LANDING_REST, [3, -2, 1])
    const box = { minX: -1, maxX: 3, minY: -2, maxY: 4, minZ: 0, maxZ: 1 }
    const cp = L.pivotPoint(box, "contact")
    const cc = L.pivotPoint(box, "centre")
    row("PIVOT", worst < 1e-12 && rest.every((v) => v === 0) && cp.join() === "1,-2,0.5" && cc.join() === "1,1,0.5",
      "poseOffset holds the pivot still for 200 poses, and rest is exactly 0",
      `worst pivot drift ${worst.toExponential(2)}; rest offset ${rest.join(",")}; contact ${cp.join(",")}; centre ${cc.join(",")}`)
  }

  /* ---- first reach ---- */
  {
    // A reveal with a pen lift: rises to 0.4 by p 0.3, holds to p 0.5, then rises to 1.
    const f = (p) => (p < 0.3 ? (p / 0.3) * 0.4 : p < 0.5 ? 0.4 : 0.4 + ((p - 0.5) / 0.5) * 0.6)
    const r1 = L.firstReach(f, 0.4)
    const r2 = L.firstReach(f, 0.7)
    const r0 = L.firstReach(f, 0)
    const r9 = L.firstReach(f, 2)
    row("REACH", Math.abs(r1 - 0.3) < 1e-9 && Math.abs(r2 - 0.75) < 1e-9 && r0 === 0 && r9 === 1,
      "firstReach finds the first crossing of a curve with flats, to 1e-9",
      `0.4 first at ${r1.toFixed(12)} (want 0.3, the flat runs to 0.5); 0.7 at ${r2.toFixed(12)}; 0 at ${r0}; unreachable at ${r9}`)
  }

  /* ---- units ---- */
  {
    const keys = ["stroke-0-12", "stroke-1-9-rod-fallback", "dd-rod-2-30", "inflate-svfi-3-40-0.1", "solid-4-0.1-0.2", "dd-solid-4-99", "inflate-implicit-200-1"]
    const u = Array.from(L.meshUnits(keys, 4, null))
    const want = [0, 1, 2, 3, L.UNIT_MARK, L.UNIT_MARK, L.UNIT_MARK]
    const clipped = Array.from(L.meshUnits(["stroke-0-5", "stroke-1-5", "stroke-2-5"], 5, [1, 3, 4]))
    const over = Array.from(L.meshUnits(["stroke-7-5"], 4, null))
    row("UNITS", u.join() === want.join() && clipped.join() === "1,3,4" && over[0] === L.UNIT_NONE,
      "mesh keys map to strokes per engine, fused meshes to the mark, clipped lists through pieces",
      `keys ${u.join(",")} (want ${want.join(",")}); clipped ${clipped.join(",")}; stroke 7 of 4 ${over[0]}`)
  }

  /* ---- off ---- */
  {
    const off = L.landingFor("off")
    const zero = { ...L.landingFor("spring"), amount: 0 }
    const ts = grid(100, (f) => -1 + 4 * f)
    const allRest = ts.every((t) => L.isRestPose(L.landingPose(off, t)) && L.isRestPose(L.landingPose(zero, t)))
    row("OFF", allRest && !L.isLandingOn(off) && !L.isLandingOn(zero) && L.landingTailMs(off, 9) === 0 && L.resolveLanding(undefined) === null && L.resolveLanding({ effect: "off" }) === null,
      "Off and a zero amount are rest at every moment and need no tail",
      `rest at 101 moments: ${allRest}; tail ${L.landingTailMs(off, 9)} ms; resolve(undefined) ${L.resolveLanding(undefined)}`)
  }
}

/* ---- the preset and the session (step 3) ---------------------------------- */
async function runWiringRows() {
  const L = loadTs(LM)
  const S = loadTs("lib/style-system.ts")
  const D = loadTs("lib/doc-store.ts")
  {
    const p = S.findPreset("completionPulse")
    const m = S.resolveMotionPreset("completionPulse")
    const lr = L.resolveLanding(m?.landing)
    const fields = S.presetFields(p).filter((k) => k.startsWith("landing."))
    row("PRESET",
      p?.implemented === true && lr?.effect === "pulse" && lr.scope === "mark" && L.isLandingOn(lr) && fields.length === 5 &&
        !!m.drawIn && !!m.revealWindow && !!m.envelope,
      "Completion Pulse is implemented, its take carries a pulse on the whole mark, and Customize lists the landing's fields",
      `implemented ${p?.implemented}; landing ${JSON.stringify(m?.landing)}; landing fields ${fields.join(", ") || "none"}`)
  }
  {
    const base = S.DEFAULT_STYLE_STATE
    const good = D.validateSession({ styleState: { ...base, landing: { effect: "spring", scope: "stroke", amount: 0.08, durationSec: 0.42, staggerMs: 50 } } })
    const wide = D.validateSession({ styleState: { ...base, landing: { effect: "wobble", scope: "mark", amount: 99, durationSec: 0.8, staggerMs: 0 } } })
    const bad = D.validateSession({ styleState: { ...base, landing: { effect: "boing" } } })
    const none = D.validateSession({ styleState: { ...base } })
    const g = good?.session.styleState.landing
    const w = wide?.session.styleState.landing
    const ok =
      g?.effect === "spring" && g.amount === 0.08 && good.repairs.length === 0 &&
      w?.amount === 20 && wide.repairs.some((r) => /landing amount 99/.test(r)) &&
      bad?.session.styleState.landing === undefined && bad.repairs.some((r) => /landing/.test(r)) &&
      !("landing" in none.session.styleState) && none.repairs.length === 0
    row("SESSION", ok, "a stored landing comes back, a bad one is turned off and named, none stays none",
      `kept ${JSON.stringify(g)}; wide amount ${w?.amount} with ${wide?.repairs.length} repair(s); bad ${bad?.session.styleState.landing} with "${bad?.repairs.find((r) => /landing/.test(r))}"; none has the key: ${"landing" in (none?.session.styleState ?? {})}`)
  }
}

/* ---- must-fails ---------------------------------------------------------- */
const MUTANTS = [
  { name: "spring starts at rest instead of settleFrom", find: "      const from = 1 - a\n", text: "      const from = 1\n", red: ["SP-START"] },
  { name: "spring's peak keyframe at 60 % instead of 62 %", find: "export const DD_LAND_PEAK_AT = 0.62", text: "export const DD_LAND_PEAK_AT = 0.6", red: ["SP-PEAK"] },
  { name: "no spring: the scale rides the curve straight to 1", find: "      const peak = 1 + (DD_LAND_PEAK - 1) * (a / LANDING_EFFECT_DEFAULTS.spring.amount)", text: "      const peak = 1", red: ["SP-PEAK"] },
  { name: "spring's second segment never comes down", find: "          : peak + (1 - peak) * ddLandEase((u - DD_LAND_PEAK_AT) / (1 - DD_LAND_PEAK_AT))", text: "          : peak", red: ["SP-REST"] },
  { name: "reduced motion ignored", find: "  if (!isLandingOn(p) || reduced || Number.isNaN(tSec)) return LANDING_REST", text: "  if (!isLandingOn(p) || Number.isNaN(tSec)) return LANDING_REST", red: ["SP-REDUCED"] },
  { name: "spring length retyped as 360 ms instead of read from the register", find: "    durationSec: DESK_DOODLES.motion.settleMs / 1000,", text: "    durationSec: 0.36,", red: ["SP-REUSE"] },
  { name: "spring curve retyped with a rounded control point", find: "export const ddLandEase = easeOfCss(DESK_DOODLES.motion.ease)", text: "export const ddLandEase = cubicBezierEase(0.2, 1, 0.36, 1)", red: ["SP-REUSE"] },
  { name: "settle about the centre, not the contact", find: "      return { scale: 1 - a * (1 - easeOutStrong(u)), rotZ: 0, pivot: \"contact\" }", text: "      return { scale: 1 - a * (1 - easeOutStrong(u)), rotZ: 0, pivot: \"centre\" }", red: ["SE-START"] },
  { name: "settle on a linear curve", find: "      return { scale: 1 - a * (1 - easeOutStrong(u)), rotZ: 0, pivot: \"contact\" }", text: "      return { scale: 1 - a * (1 - u), rotZ: 0, pivot: \"contact\" }", red: ["SE-REUSE"] },
  { name: "settle overshoots rest (back curve)", find: "      return { scale: 1 - a * (1 - easeOutStrong(u)), rotZ: 0, pivot: \"contact\" }", text: "      return { scale: 1 - a * (1 - easeOutStrong(u)) + 0.05 * Math.sin(Math.PI * u), rotZ: 0, pivot: \"contact\" }", red: ["SE-PEAK"] },
  { name: "settle ends short of rest", find: "  if (tSec >= dur) return p.effect === \"settle\" ? { ...LANDING_REST, pivot: \"contact\" } : LANDING_REST", text: "  if (tSec >= dur) return p.effect === \"settle\" ? { ...LANDING_REST, scale: 0.999, pivot: \"contact\" } : LANDING_REST", red: ["SE-REST"] },
  { name: "wobble starts at full swing (cos)", find: "Math.sin(2 * Math.PI * WOBBLE_CYCLES * u) * v * v", text: "Math.cos(2 * Math.PI * WOBBLE_CYCLES * u) * v * v", red: ["WO-START"] },
  { name: "wobble never decays", find: "      const v = 1 - u\n", text: "      const v = 1\n", red: ["WO-REST"] },
  { name: "wobble's swing grows instead of dying", find: "      const v = 1 - u\n", text: "      const v = 0.3 + u\n", red: ["WO-PEAK"] },
  { name: "pulse fires at full swell on the landing", find: "      const env = pulseEnvelope(u * PULSE_LIFETIME)", text: "      const env = pulseEnvelope(u * PULSE_LIFETIME + PULSE_ATTACK_SECONDS)", red: ["PU-START"] },
  { name: "pulse envelope run on its own clock, not the length", find: "      const env = pulseEnvelope(u * PULSE_LIFETIME)", text: "      const env = pulseEnvelope(u * PULSE_LIFETIME * 0.5)", red: ["PU-PEAK", "PU-REUSE"] },
  { name: "pulse drops its last 4 % in one frame (cutoff not lifted)", find: "Math.max(0, (env - PULSE_CUTOFF) / (1 - PULSE_CUTOFF))", text: "env", red: ["PU-REST"] },
  { name: "stagger ignored", find: "    const s = Math.max(landMs[i], prev + Math.max(0, staggerMs))", text: "    const s = landMs[i]", red: ["STAGGER"] },
  { name: "stagger shifts every landing, not just the close ones", find: "    const s = Math.max(landMs[i], prev + Math.max(0, staggerMs))", text: "    const s = landMs[i] + (prev === -Infinity ? 0 : staggerMs)", red: ["STAGGER"] },
  { name: "pivot offset with the turn's sign flipped", find: "    px - q.scale * (c * px - s * py),", text: "    px - q.scale * (c * px + s * py),", red: ["PIVOT"] },
  { name: "first reach lands at the end of a flat", find: "    if (f(mid) >= target) hi = mid", text: "    if (f(mid) > target) hi = mid", red: ["REACH"] },
  { name: "fused Solid read as stroke 4", find: "const FUSED_KEY = /^(?:solid-|dd-solid-|inflate-implicit-|inflate-fallback-)/", text: "const FUSED_KEY = /^(?:inflate-implicit-|inflate-fallback-)/", red: ["UNITS"] },
  { name: "Completion Pulse back to a shell", file: "lib/style-system.ts", find: "      landing: landingFor(\"pulse\", \"mark\"),\n", text: "", red: ["PRESET"] },
  { name: "Completion Pulse pulses each stroke, not the mark", file: "lib/style-system.ts", find: "      landing: landingFor(\"pulse\", \"mark\"),\n", text: "      landing: landingFor(\"pulse\"),\n", red: ["PRESET"] },
  { name: "the session drops the landing", file: "lib/doc-store.ts", find: "    style.landing = landing\n", text: "", red: ["SESSION"] },
  { name: "the session clamps in silence", file: "lib/doc-store.ts", find: "        repairs.push(`the session's landing ${k} ${String(raw[k])} was outside what the controls offer, so it is ${landing[k]}`)", text: "        void k", red: ["SESSION"] },
  { name: "Off reads as on (isLandingOn ignores the effect)", find: "  return !!p && p.effect !== \"off\" && p.amount > 0 && p.durationSec > 0", text: "  return !!p && p.amount > 0 && p.durationSec > 0", red: ["OFF"] },
  { name: "a zero amount still counts as on", find: "  return !!p && p.effect !== \"off\" && p.amount > 0 && p.durationSec > 0", text: "  return !!p && p.effect !== \"off\" && p.durationSec > 0", red: ["OFF"] },
]

function editFor(src, file, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-landing-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const file = m.file ?? LM
      const src = readFileSync(join(ROOT, file), "utf8")
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [file]: [editFor(src, file, m.find, m.text)] }))
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
  await runWiringRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(10)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && rows.length >= 23 && caught === muts.length && unguarded.length === 0 ? 0 : 1)
