/**
 * style-fusion.ts — FUSION (PRD Layer 14) + ANIMATED FUSION (PRD Layer 15).
 *
 * WHAT FUSION IS. The layer stack lets systems COEXIST (each with its own
 * settings); stack animation moves the GROUP uniformly. Fusion is the third
 * thing: systems INFLUENCE EACH OTHER — one layer's per-frame output value
 * becomes another layer's per-frame input. "ASCII glyph density drives dither
 * threshold" is a fusion relationship; "ASCII and dither are both on" is not.
 *
 * ARCHITECTURE. Fusion is a MODULATION LAYER computed once per frame on the
 * CPU, on top of the resolved style state. `evaluateFusion` returns a
 * `FusionFrame` of multipliers/offsets which viewport-3d.tsx applies to the
 * uniform writes and material-parameter writes it already performs. Nothing
 * here forks a renderer, adds a shader, or touches geometry — every existing
 * system stays honest and untouched, and each relationship is one readable
 * line of math instead of a shader special-case.
 *
 * WHY CPU-SIDE. A relationship like "glyph density drives dither threshold"
 * needs the DRIVER's current value. Both the driver signal and the driven
 * parameter are plain numbers that already cross the CPU→GPU boundary as
 * uniforms every frame, so the relationship is computed where both are visible
 * and cheap: right before the uniform write. The driven system renders with a
 * value that is *literally derived from* the driving system's value — that is
 * the honest version of "one layer's output is another layer's input".
 *
 * TIMING. Everything time-driven ultimately rides the ONE shared StyleClock
 * (lib/style-clock.ts): `elapsed`, `reveal`, `sinceCompletion`. No second
 * clock. Three globally-shared behaviours from the PRD live here for every
 * preset:
 *   - REVEAL GATE:  reveal progress scales every relationship at once, so
 *     during a replay the systems visibly LOCK TOGETHER as the stroke draws.
 *   - COMPLETION PULSE: the moment the draw-in finishes, one shared decaying
 *     kick runs through every driven parameter simultaneously.
 *   - ARMING: choreographies measure from "when this preset was selected"
 *     (`sinceArmed`) as well as from the reveal, so selecting an animated
 *     fusion long after the stroke completed still PLAYS its choreography
 *     instead of showing a build that "had always already finished" (the
 *     documented scene-start-fade trap).
 *
 * ANIMATED FUSION = the same relationships, but they EVOLVE: build over the
 * reveal, open once and settle, surge in data bursts, decelerate to rest,
 * escalate to a controlled break. Static fusion keeps a gentle AMBIENT drive
 * (a relationship you can only see when the driver moves is invisible on an
 * idle canvas); the animated variant replaces ambience with choreography.
 */

import type { StyleState } from "./style-system"
import type { StyleClock } from "./style-clock"

/* ------------------------------ output frame ------------------------------ */

/**
 * Per-frame modulation of the already-resolved style values. Multipliers
 * default to 1, offsets to 0, so the identity frame changes nothing. Applied
 * by viewport-3d.tsx AFTER each system's own state/stack/timing resolution —
 * fusion modulates the final write, it never replaces a system's own logic.
 */
export interface FusionFrame {
  /* texture (pattern layer) */
  textureIntensityMul: number
  textureScaleMul: number
  textureTimeAdd: number
  /* dither (threshold layer) */
  ditherIntensityMul: number
  ditherThresholdAdd: number
  ditherScaleMul: number
  ditherTimeAdd: number
  /* ascii (glyph layer) */
  asciiDensityAdd: number
  asciiTimeAdd: number
  /* material (surface response — applied after animated-material/base pinning).
   * Angle-dependent levers (clearcoat/env/roughness) are always paired with an
   * angle-INDEPENDENT one (emissive or wet-darkening) because the former were
   * repeatedly measured near-invisible at stroke scale in this codebase. */
  clearcoatAdd: number
  roughnessAdd: number
  envMapAdd: number
  sheenAdd: number
  metalnessAdd: number
  emissiveAdd: number
  /** Emissive colour to use when the base material's emissive is black. */
  emissiveColor: string | null
  /** Multiplies the albedo (1 = unchanged, <1 = wet-look darkening). */
  colorScale: number
  /** Shine band override — the travelling highlight LOCKED to a moving layer
   *  field ("material shine follows the moving ASCII field"). Null = no band. */
  sweep: { pos: number; amt: number; width: number; dirX: number; dirY: number } | null
}

const IDENTITY: Omit<FusionFrame, "sweep"> = {
  textureIntensityMul: 1,
  textureScaleMul: 1,
  textureTimeAdd: 0,
  ditherIntensityMul: 1,
  ditherThresholdAdd: 0,
  ditherScaleMul: 1,
  ditherTimeAdd: 0,
  asciiDensityAdd: 0,
  asciiTimeAdd: 0,
  clearcoatAdd: 0,
  roughnessAdd: 0,
  envMapAdd: 0,
  sheenAdd: 0,
  metalnessAdd: 0,
  emissiveAdd: 0,
  emissiveColor: null,
  colorScale: 1,
}

function identityFrame(): FusionFrame {
  return { ...IDENTITY, sweep: null }
}

/* ------------------------------- inputs ----------------------------------- */

/**
 * Live per-frame values the layers are ACTUALLY rendering with, handed in by
 * viewport-3d.tsx after it computes them. This is what makes the cross-links
 * honest: e.g. the ASCII-Rubber shine band is positioned from the very
 * uniform value the glyph grid scrolls with, so changing the ASCII speed dial
 * provably changes the band's speed.
 */
export interface FusionSignals {
  /** Value written to uFsAscTime this frame (glyph-grid phase, in cells). */
  asciiTime: number
  /** Value written to uFsDitTime this frame (threshold-matrix phase). */
  ditherTime: number
  /** Value written to uFsTexTime this frame (pattern phase). */
  textureTime: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** Deterministic 0..1 hash for glitch-event scheduling (matches the shader's
 *  sin-fract family; good enough for event dice, cheap enough per frame). */
const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* ------------------------------ evaluation -------------------------------- */

/**
 * Compute this frame's fusion modulation. Returns null when no fusion preset
 * is active, so the caller can skip all application work.
 *
 * @param sinceArmed seconds since the current fusion preset (or its animated
 *   flag) was last changed — supplied by the caller from the shared clock.
 */
export function evaluateFusion(
  state: StyleState,
  clock: StyleClock,
  signals: FusionSignals,
  sinceArmed: number,
): FusionFrame | null {
  const preset = state.fusionPreset
  if (preset === "none") return null

  const f = identityFrame()

  // Master depth dial. Amplitudes below are sized so the default 0.5 is
  // CLEARLY visible (the "technically correct but perceptually absent" trap);
  // 1.0 is strong, 0 disables the relationships without disabling the look.
  const depth = clamp01(state.fusionIntensity)
  if (depth <= 0) return f

  const spd = Math.max(state.fusionAnimationSpeed, 0.05)
  const animated = state.fusionAnimationEnabled

  // Motion mode is the substrate-level "may style animate" switch. When it is
  // off, the ambient/choreography clock freezes at a fixed representative
  // phase — the relationship is still SET (the systems stay linked), it just
  // does not move. Reveal- and completion-driven coupling still applies:
  // those are driven by geometry playback, not by style time.
  const t = state.motionMode === "off" ? 1.7 : clock.elapsed * spd

  // REVEAL GATE — "reveal progress controls all the relationships at once".
  // Smoothstep so the linkage eases in over the draw instead of snapping.
  const rv = clamp01(clock.reveal)
  const revGate = rv * rv * (3 - 2 * rv)

  // COMPLETION PULSE — one shared decaying kick for every preset. Fast decay
  // (~0.5s to half) so it reads as an EVENT, not a lingering state.
  const since = clock.sinceCompletion
  const pulse = since === Infinity ? 0 : Math.exp(-since / 0.5)

  // Effective relationship strength this frame.
  const k = depth * revGate

  switch (preset) {
    /* --------------------------- Terminal Gel --------------------------- */
    // CONCEPT: a terminal readout suspended in soft gel — the characters and
    // the gel are ONE organism. RELATIONSHIP: glyph density is the driver;
    // the gel's shine/glow is computed from the same density signal, so the
    // surface glosses up and lights from within exactly as the characters
    // thicken, and dulls as they thin.
    case "terminalGel": {
      // Driver: glyph density. Static = slow breath; Reveal Build = density
      // builds with the draw-in (and with sinceArmed, so selecting the
      // animated preset on a finished stroke still plays the build).
      let dens: number
      if (animated) {
        const build = Math.min(rv, clamp01(sinceArmed / (3.2 / spd)))
        const settleBreath = 0.5 + 0.5 * Math.sin(t * 1.1)
        // Build from sparse to full, then keep a small residual breath.
        dens = -0.55 * (1 - build) + 0.08 * (settleBreath - 0.5) * build
      } else {
        const breath = 0.5 + 0.5 * Math.sin(t * 1.4)
        dens = (breath - 0.5) * 0.5
      }
      dens += pulse * 0.3 // shared pulse: characters flare dense at completion
      f.asciiDensityAdd = dens * k
      // Driven: shine FROM the density signal (0 when glyphs thinned).
      const shine = clamp01(dens + 0.55) // recentre so breath spans 0.05..1
      f.clearcoatAdd = shine * 0.9 * k
      f.roughnessAdd = -shine * 0.5 * k
      f.envMapAdd = shine * 1.6 * k
      f.sheenAdd = shine * 0.6 * k
      // Angle-independent half of the shine: the gel glows faintly from
      // within as the characters thicken.
      f.emissiveAdd = (shine * 0.5 + pulse * 0.8) * k
      f.emissiveColor = "#a9c3e8"
      return f
    }

    /* --------------------------- Dither Bloom --------------------------- */
    // CONCEPT: a print whose ink is still WET — the halftone screen blooms
    // open and closed, and the surface wets/gloss-darkens with it.
    // RELATIONSHIP: the dither threshold is the driver; material shine (and
    // wet darkening) is computed from the same threshold signal.
    case "ditherBloom": {
      // Driver: the bloom signal 0..1 — how much INK is flooding the screen.
      // Static = slow breath. Threshold Open = the print starts SOAKED (fully
      // inked, wet-dark) and dries open over the reveal (or over ~2.8s after
      // selection), settling into a residual breath.
      let bloom: number
      if (animated) {
        const open = Math.min(rv, clamp01(sinceArmed / (2.8 / spd)))
        const settle = 0.5 + 0.5 * Math.sin(t * 0.9)
        bloom = (1 - open) + 0.25 * settle * open
      } else {
        bloom = 0.5 + 0.5 * Math.sin(t * 1.1)
      }
      bloom = clamp01(bloom + pulse * 0.5) // shared pulse: one ink flood
      // Driven 1: the threshold. Negative bias = tone pushed down = MORE ink —
      // the halftone dots grow and merge as the bloom rises.
      f.ditherThresholdAdd = -(bloom - 0.35) * 0.65 * k
      // Driven 2: shine from the SAME signal — flooding ink is WET ink.
      f.clearcoatAdd = bloom * 0.9 * k
      f.roughnessAdd = -bloom * 0.6 * k
      f.envMapAdd = (bloom * 2.0 + pulse * 1.0) * k
      // Angle-independent half: wet surfaces DARKEN (pores fill, light is
      // absorbed) — the readable wet-look at stroke scale.
      f.colorScale = 1 - bloom * 0.45 * k
      return f
    }

    /* ---------------------------- Signal Ink ---------------------------- */
    // CONCEPT: ink that carries a live signal — energy bursts travel the
    // stroke. RELATIONSHIP: one burst signal drives glow and pattern in
    // ANTI-PHASE: the surge of light washes the data marks out of the ink,
    // and as it decays the bitmap pattern floods back in. (In-phase was
    // judged live and read muddy: the brightened body starves the threshold
    // of dark tone at the exact moment the pattern is told to bite, so the
    // two fight. Anti-phase works WITH the tone physics — one wire, two
    // systems, visibly opposite ends of it.)
    case "signalInk": {
      // Driver: an irregular burst signal (frequency-modulated sine reads as
      // organic bursts, not a metronome).
      const n = 0.5 + 0.5 * Math.sin(t * 1.9 + Math.sin(t * 0.7) * 2.4)
      const burst = clamp01(n + pulse) // shared pulse = one full-strength burst
      // Driven 1: the pattern retreats as the burst rises, floods back after.
      f.ditherIntensityMul = 1 - k * (0.85 * burst)
      // Driven 2: the glow surges with the SAME signal (angle-independent).
      f.emissiveAdd = burst * 1.6 * k
      f.emissiveColor = "#39c1e8"
      f.metalnessAdd = (burst - 0.5) * 0.2 * k
      f.envMapAdd = burst * 0.8 * k
      // Animated (Data Flow): the matrix's travel speed itself surges with
      // the signal — packets of pattern visibly accelerate through the
      // stroke. Phase warp = integral-free speed surge: sin-warped time has a
      // derivative that swells and eases with the same rhythm as `n`.
      if (animated) {
        f.ditherTimeAdd = Math.sin(t * 1.9 + Math.sin(t * 0.7) * 2.4) * 6 * k
        f.textureTimeAdd = f.ditherTimeAdd * 0.4
      }
      return f
    }

    /* --------------------------- ASCII Rubber --------------------------- */
    // CONCEPT: a rubber skin with a current of characters running under it.
    // RELATIONSHIP: "material shine follows the moving ASCII field" — the
    // travelling highlight band's position is derived from the very uniform
    // the glyph grid scrolls with (signals.asciiTime), so the shine and the
    // characters move as one current. Change the ASCII speed dial and the
    // band provably changes speed with it.
    case "asciiRubber": {
      // Driver: the glyph field's actual phase this frame (in grid cells).
      let phase = signals.asciiTime
      // Animated (Slowdown): after completion (or after selecting the preset)
      // the current decelerates elastically to rest. Stateless deceleration:
      // replace the linear post-completion phase advance (`sinceStop * rate`)
      // with an exponential approach (`tau * (1 - e^-s/tau) * rate`) — the
      // field glides to a stop instead of cutting. The shine band rides the
      // same corrected phase, so both slow down TOGETHER.
      if (animated) {
        const sinceStop = Math.min(
          since === Infinity ? Infinity : since,
          sinceArmed,
        )
        if (sinceStop !== Infinity && sinceStop > 0) {
          const tau = 1.4 / spd
          const cellRate = state.asciiScrollSpeed * 1.6 // viewport's ascii speed factor
          const slowed = tau * (1 - Math.exp(-sinceStop / tau))
          f.asciiTimeAdd = (slowed - sinceStop) * cellRate
          phase += f.asciiTimeAdd
        }
      }
      // Driven: the shine band travels with the field. One band pass per 7
      // grid cells — at the default scroll speed the band crosses the stroke
      // every few seconds, clearly a moving light and clearly the same
      // current as the glyphs (judged live: at 14 cells a pass took ~10s and
      // the band read as a static bright patch).
      const cyc = phase / 7 - Math.floor(phase / 7)
      const dirX = state.asciiDirection === "vertical" ? 0 : 1
      const dirY = state.asciiDirection === "vertical" ? 1 : 0
      f.sweep = {
        pos: -1.15 + cyc * 2.3,
        amt: (0.7 + 0.3 * pulse) * k,
        width: 0.42,
        dirX,
        dirY,
      }
      // Rubber warms faintly where the current runs (angle-independent read).
      f.sheenAdd = 0.4 * k
      f.emissiveAdd = pulse * 0.6 * k
      f.emissiveColor = "#8f7d68"
      return f
    }

    /* ------------------------- Scanline Balloon ------------------------- */
    // CONCEPT: an inflated skin with scanlines printed on it — as the balloon
    // breathes, the lines RIDE the skin: they spread as it swells and pack
    // tight as it relaxes, while the stretched skin goes shinier.
    // RELATIONSHIP: one breath signal drives scanline spacing AND surface
    // tension (sheen/clearcoat/glow).
    case "scanlineBalloon": {
      let breath: number
      if (animated) {
        // Soft Pulse: after the draw completes (or the preset is selected),
        // gentle recurring swells every ~3s that slowly settle — a balloon
        // coming to rest. Before completion, the breath follows the reveal.
        const s = Math.min(since === Infinity ? Infinity : since, sinceArmed)
        if (s !== Infinity && s >= 0) {
          const wave = Math.max(0, Math.sin((2 * Math.PI * s * spd) / 3))
          breath = wave * wave * Math.exp(-s / 14)
        } else {
          breath = rv * 0.6
        }
      } else {
        breath = 0.5 + 0.5 * Math.sin(t * 1.3)
      }
      breath = clamp01(breath + pulse * 0.5)
      // Driven 1: scanline spacing — the pattern's scale swells with the skin.
      f.textureScaleMul = 1 + (breath - 0.35) * 0.85 * k
      f.textureIntensityMul = 1 - breath * 0.25 * k // stretched print thins
      // Driven 2: surface tension from the SAME breath.
      f.sheenAdd = breath * 0.8 * k
      f.clearcoatAdd = breath * 0.5 * k
      f.envMapAdd = breath * 1.2 * k
      f.emissiveAdd = breath * 0.35 * k // inner glow = angle-independent half
      f.emissiveColor = "#a9c3e8"
      return f
    }

    /* ---------------------------- Pixel Clay ---------------------------- */
    // CONCEPT: clay mid-digitisation — the material keeps trying to resolve
    // into pixels and relaxing back. RELATIONSHIP: one digitise signal drives
    // dither pixel SIZE (chunky ↔ fine), the clay's grain (dissolves as the
    // pixels take over), and the surface (sinters wet-dark as it digitises).
    // (No animated variant in the PRD — the ambient drive is the preset.)
    case "pixelClay": {
      const dig = clamp01(0.5 + 0.5 * Math.sin(t * 0.9) + pulse * 0.6)
      // Driven 1: threshold cells grow chunky with the signal.
      f.ditherScaleMul = 1 + dig * 1.1 * k
      // Driven 2: the organic grain dissolves as the digital pattern takes over.
      f.textureIntensityMul = 1 - dig * 0.7 * k
      // Driven 3: sintering — the clay glosses and darkens as it digitises.
      f.roughnessAdd = -dig * 0.5 * k
      f.clearcoatAdd = dig * 0.6 * k
      f.colorScale = 1 - dig * 0.3 * k // angle-independent read
      return f
    }

    /* ---------------------------- Code Bloom ----------------------------- */
    // CONCEPT: source code blooming on the surface — as the characters
    // thicken, the tone under them opens up. RELATIONSHIP: the PRD's first
    // fusion relationship, literally: ASCII glyph density DRIVES the dither
    // threshold. One density signal is written to the glyph ramp AND (negated)
    // to the threshold bias, so stipple densifies exactly as characters do.
    case "codeBloom": {
      let dens: number
      if (animated) {
        // Character Reveal: density strictly follows the draw-in (re-armed on
        // selection so it plays on a finished stroke too).
        const build = Math.min(rv, clamp01(sinceArmed / (3.0 / spd)))
        dens = -0.6 * (1 - build)
      } else {
        const bloomS = 0.5 + 0.5 * Math.sin(t * 1.2)
        dens = (bloomS - 0.5) * 0.5
      }
      dens += pulse * 0.25
      // Driver value, written to the glyph layer…
      f.asciiDensityAdd = dens * k
      // …and the SAME value (negated: denser glyphs = lower threshold = more
      // ink) written to the dither layer. This line IS the fusion.
      f.ditherThresholdAdd = -dens * 0.9 * k
      // Faint phosphor warmth as the code blooms (angle-independent).
      f.emissiveAdd = clamp01(dens + 0.5) * 0.35 * k + pulse * 0.5 * k
      f.emissiveColor = "#7ec8a0"
      return f
    }

    /* --------------------------- Glitch Ribbon --------------------------- */
    // CONCEPT: a ribbon of signal that keeps BREAKING — and every system
    // breaks on the same event. RELATIONSHIP: one shared glitch impulse
    // simultaneously jolts the dither matrix, re-rolls the glyph field,
    // shears the texture phase and spikes the glow: proof of a single driver
    // is that the breaks are exactly simultaneous.
    case "glitchRibbon": {
      // Event scheduler: fixed slots, dice per slot, sharp decaying envelope
      // inside the slot. Deterministic (hash of slot index), so headless and
      // headed runs agree.
      const slotLen = 1.1 / spd
      const slot = Math.floor(t / slotLen)
      const inSlot = t - slot * slotLen
      let fires = hash01(slot) // 0..1 dice
      let strength = 0.55 + 0.45 * hash01(slot + 7)
      let threshold = 0.45 // slots with dice above this fire
      let envLen = 0.16 / spd
      if (animated) {
        // Controlled Break: a ~7s cycle — calm, escalating stutters, one big
        // tear at the peak, recovery. Event rate and strength follow the
        // cycle position instead of being uniform.
        const cyc = (t / 7) % 1
        const escalation = cyc < 0.75 ? cyc / 0.75 : 1 - (cyc - 0.75) / 0.25
        threshold = 0.85 - escalation * 0.7 // calm: rare. peak: near-constant
        strength *= 0.4 + escalation * 0.9
        // The big tear: one long full-strength event at the cycle peak.
        if (cyc > 0.72 && cyc < 0.78) {
          fires = 1
          strength = 1.4
          envLen = 0.45 / spd
        }
      }
      const env = inSlot < envLen ? 1 - inSlot / envLen : 0
      const g = (fires > threshold ? env * strength : 0) + pulse * 0.8
      if (g > 0.001) {
        const sign = hash01(slot + 13) > 0.5 ? 1 : -1
        // Everything breaks on the SAME impulse:
        f.ditherTimeAdd = g * 40 * sign // matrix jolts sideways
        f.asciiTimeAdd = g * 30 // glyph field re-rolls
        f.textureTimeAdd = g * 10 * sign // pattern shears
        f.ditherThresholdAdd = g * (hash01(slot + 29) - 0.5) * 0.5 * k // tone jumps
        f.emissiveAdd = g * 2.0 * k // glow spikes
        f.emissiveColor = "#39c1e8"
        f.metalnessAdd = g * 0.25 * k
        // Time jolts scale with depth too — at low intensity the breaks soften.
        f.ditherTimeAdd *= k
        f.asciiTimeAdd *= k
        f.textureTimeAdd *= k
      }
      return f
    }

    default:
      return f
  }
}
