"use client"

import {
  type StyleState,
  type CustomMaterial,
  MATERIAL_PRESETS,
  MATERIAL_ANIMATION_TYPES,
  resolveMaterialParams,
  materialParamsToCustom,
  TEXTURE_MODES,
  TEXTURE_ANIMATION_TYPES,
  DITHER_PRESETS,
  ASCII_PRESETS,
  type PresetFamily,
  PRESET_FAMILY_OPTIONS,
  PRESET_REGISTRY,
  findPreset,
  findFusionShapeDef,
  resolveViewPreset,
  viewPresetBlockers,
  presetStateGap,
  type FusionDrive,
} from "@/lib/style-system"
import {
  resolveFusionDrive,
  FUSION_SOURCES,
  FUSION_TARGETS,
  FUSION_READOUT,
  BUILTIN_LINK_FUSIONS,
  describeFusion,
  newCustomFusion,
  newFusionLink,
  fuseEverything,
  fusionWakePatch,
  fusionFixPatch,
  fusionLinkSleep,
  customFusionKey,
  customFusionIdOf,
  FUSION_SYSTEMS,
  FUSION_COMBO_LIST,
  FUSION_COMBOS_BY_KEY,
  SHIPPED_BY_COMBO_KEY,
  FUSION_VIEW_SPIN_DEG,
  comboFusionKey,
  comboKeyOf,
  type CustomFusion,
  type FusionCombo,
  type FusionLink,
  type FusionSourceId,
  type FusionSystemId,
  type FusionTargetId,
  type FusionFixKey,
} from "@/lib/style-fusion"
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  deleteMinePreset,
  findPresetIn,
  isMinePreset,
  presetEditedFields,
  presetLiveValue,
  presetTakeReset,
  type PresetFieldKey,
  type TakeState,
  presetFields,
  renameMinePreset,
  resetPresetField,
  saveMinePreset,
  type StylePreset,
} from "@/lib/style-system"
import type React from "react"
import { DrawInTimingControls, OPEN_ANIMATION_PANEL_EVENT } from "@/components/draw-in-timing-controls"

/** What the Animation tab needs to render the draw-in controls: the same props
 * the Timing popover passes, because it is the same component. */
export type DrawInTimingProps = React.ComponentProps<typeof DrawInTimingControls>

/**
 * StylePanelScaffold
 * ------------------
 * The single home for each style system's controls. The summary strip in
 * app/page.tsx is the drawer's HEADER: each chip shows the current selection and
 * opens (or closes) the matching panel; the live control for each system lives
 * HERE, inside its own panel. The scaffold renders nothing while closed.
 *
 * Nothing here fakes functionality: panels without a renderer are clearly
 * labeled "coming soon".
 */

/* ====================================================================== */
/*  THE TWO FAMILIES THE RAIL DID NOT SHOW, AND WHY THEY DO NOW           */
/* ---------------------------------------------------------------------- */
/*  `PRESET_FAMILY_OPTIONS` in lib/style-system.ts is a SHIPPING GATE, not */
/*  a label table: a family appears there only once selecting one of its   */
/*  members actually does what the member's name says. Geometry and View   */
/*  were held off it because their patches are a mode + dials (five        */
/*  useState hooks in app/page.tsx) and imperative camera/export calls —   */
/*  neither of which `applyPresetToStyleState` can reach. Their pills are  */
/*  `enabled: false` for the same reason. Both are correct as written.     */
/*                                                                          */
/*  THAT ROUTING NOW EXISTS (app/page.tsx `applyGeometryPresetById` /       */
/*  `applyViewPresetById`), so the gate's condition is met. The opt-in is   */
/*  declared HERE, in the consumer, rather than by editing the shared       */
/*  module, because that module belongs to another live lane — the         */
/*  per-consumer opt-in that leaves shared defaults alone is the pattern    */
/*  the concurrency rules ask for.                                          */
/*                                                                          */
/*  IT IS DEDUPE-SAFE AND COLLAPSES CLEANLY. When that lane flips           */
/*  `enabled: true` and adds the two rows to `PRESET_FAMILY_OPTIONS`, the   */
/*  union below stops adding anything and `p.enabled` starts carrying the   */
/*  pills on its own — no duplicate rows, no second source of truth, and    */
/*  this block can be deleted in one piece.                                 */
/* ====================================================================== */

/** Families whose patch is routed by app/page.tsx instead of by
 *  `applyPresetToStyleState`, with the label the rail shows. */
const ROUTED_FAMILIES: { id: PresetFamily; label: string }[] = [
  { id: "geometry", label: "Geometry" },
  { id: "view", label: "View / Export" },
  /* Family 14, added 2026-09-04 with the five working motion presets. This list
   * and `NON_STYLE_FAMILIES` in `lib/style-system.ts` are ONE FACT stated in two
   * files, and `assert-style-contracts` holds them equal: adding the family
   * there and not here is what turned that row red within the hour. */
  { id: "geometryAnimation", label: "Geometry Animation" },
]

/** `PRESET_FAMILY_OPTIONS` plus any routed family it does not already list. */
export const RAIL_FAMILY_OPTIONS: { id: PresetFamily; label: string }[] = [
  ...PRESET_FAMILY_OPTIONS,
  ...ROUTED_FAMILIES.filter((r) => !PRESET_FAMILY_OPTIONS.some((f) => f.id === r.id)),
]

/**
 * ⚠ `viewPresetGaps` AND `CLOSED_BLOCKER_PREFIX` ARE GONE — 2026-08-03.
 *
 * They existed because `lib/style-system.ts` reported the camera turntable as
 * blocked ("OrbitControls is mounted without autoRotate") long after it was
 * built, and that table "could not be corrected from here (its file is another
 * lane's)". So this file filtered the stale entry out by matching the first
 * seventeen characters of its sentence — two modules coupled through a string,
 * which `assert-style-contracts` §5 then had to spend five rows guarding
 * ("reword the blocker and a shipped preset silently becomes unselectable with
 * no test failing and no error anywhere").
 *
 * The table is corrected now: `viewPresetBlockers()` no longer reports the
 * turntable, and `portfolioSpin.implemented` is `true`. With the source true
 * there is nothing to filter, so both the wrapper and the prefix are removed
 * rather than left as a filter that matches nothing — a second name for one
 * thing is how a control silently stops reaching what it names, and this file
 * has just been on the receiving end of that.
 *
 * Callers read `viewPresetBlockers` directly, and as of 2026-08-03 it reports
 * NOTHING for any member — the video entry went the same way as the turntable
 * once `applyViewPresetById` got its `target === "video"` branch, so "Video
 * Preview Export" is selectable and renders a real file. The function is still
 * the thing this file asks, because the next member that outruns the app has to
 * be able to say so from ONE place; what must never come back is this file
 * deciding for itself which of its answers to believe.
 */

/** Can this pill be clicked? A preset with no renderer AND no patch is inert —
 *  clicking it would run the composition reset and apply nothing. A view preset
 *  with an unclosed gap is likewise refused, with the gap as its tooltip. */
export function presetIsSelectable(family: PresetFamily, p: { id: string; implemented: boolean; applies?: unknown; view?: unknown; geometry?: unknown; motion?: unknown }): boolean {
  if (family === "view") return !!p.view && viewPresetBlockers(p.id).length === 0
  if (family === "geometry") return !!p.geometry
  /* Family 14 carries its patch on `motion`, not `applies`, for the same reason
   * families 1 and 15 do: the take is not style state. Without this arm the
   * five that now have real patches still rendered disabled and "soon", which
   * is the mirror of the defect the `inert` guard exists for — there, a pill
   * did more than it should; here, it did nothing while a patch sat behind it. */
  if (family === "geometryAnimation") return !!p.motion
  return !(!p.implemented && !p.applies)
}

type PanelStatus = "active" | "reserved"

/** Stable ids shared with the top strip so it can open a matching panel. */
export type StylePanelId =
  | "material"
  | "animation"
  | "texture"
  | "dither"
  | "ascii"
  | "presets"
  | "layers"
  | "fusion"

type PanelDef = {
  id: StylePanelId
  label: string
  status: PanelStatus
  note: string
  futureControls: string[]
}

const PANELS: PanelDef[] = [
  {
    id: "material",
    label: "Material",
    status: "active",
    note: "What the form is made of. The surface the light responds to.",
    futureControls: [],
  },
  {
    id: "animation",
    label: "Animation",
    status: "active",
    note: "Timing for everything that moves. Each system's own animation lives in its panel.",
    futureControls: [],
  },
  {
    id: "texture",
    label: "Texture",
    status: "active",
    note: "A pattern living on the surface: grain, scanlines, bands, contour.",
    futureControls: [],
  },
  {
    id: "dither",
    label: "Dither",
    status: "active",
    note: "Shading broken into graphic marks, like print.",
    futureControls: [],
  },
  {
    id: "ascii",
    label: "ASCII",
    status: "active",
    note: "The surface redrawn as a grid of characters.",
    futureControls: [],
  },
  {
    id: "presets",
    label: "Presets",
    status: "active",
    note: "Good starting points. Everything a preset sets stays editable afterwards.",
    futureControls: [],
  },
  {
    id: "layers",
    label: "Layers",
    status: "active",
    note: "How the visual systems stack. Balance, blend and order.",
    futureControls: [],
  },
  {
    id: "fusion",
    label: "Fusion",
    status: "active",
    note: "Authored looks where the systems drive each other, so one layer's output is another's input.",
    futureControls: [],
  },
]

/**
 * ANIMATION_CATEGORIES — the full, explicit Animation IA. This is the spec's
 * required "Animation is not only animated material" correction. Only
 * `material` is functional this branch; the rest carry the reserved future
 * branch label so the system is honestly scoped and nothing has to be renamed
 * when those phases land.
 */
const ANIMATION_CATEGORIES: {
  key: string
  label: string
  state: "active" | "basic" | "reserved"
  detail: string
}[] = [
  {
    key: "geometry",
    label: "Geometry",
    /* `basic` renders a "playback" badge on a transparent card, one rank below
     * Material's "live". Measured 2026-08-28: Geometry is the MOST built family
     * in the product — sixteen controls, all reachable from a user's own drawing
     * (order, unit, overlap, align, reverse, easing, loop, and the four reveal
     * window modes). It was ranked below Material by a label nobody re-read after
     * the scheduler shipped. */
    state: "active",
    /* This said "Easing, loop, and reveal styles come later" and pointed at a
     * "timeline". Measured 2026-08-28: all three shipped, and there is no
     * timeline — the control under the 3D view is a transport bar with a
     * `Draw-in timing` popover, suppressed only under `chromeless`, which the
     * product does not pass. So the copy was wrong twice and told a user a
     * working feature was unbuilt. Naming the real control is the whole fix. */
    detail: "The form draws itself in. Its controls sit at the top of this tab, and again behind Timing under the 3D view, next to Play.",
  },
  {
    key: "material",
    label: "Material",
    state: "active",
    detail: "The surface responds over time: shine sweep, gel shimmer, roughness pulse. Lives in the Material panel.",
  },
  {
    key: "texture",
    label: "Texture",
    state: "active",
    detail: "The pattern moves: grain drift, scanline scroll, band crawl. Lives in the Texture panel.",
  },
  {
    key: "dither",
    label: "Dither",
    state: "active",
    detail: "The threshold moves. The matrix crawls, tone opens and closes. Lives in the Dither panel.",
  },
  {
    key: "ascii",
    label: "ASCII",
    state: "active",
    detail: "The glyphs move: scroll, rain, cycle, flicker. Lives in the ASCII panel.",
  },
  {
    key: "layer",
    label: "Per-layer timing",
    state: "active",
    detail: "Each animated layer picks its own clock and delay, set in that layer's panel.",
  },
  {
    key: "stack",
    label: "Whole stack",
    state: "active",
    detail: "The stack moves as one group: fade, pulse, drift, freeze on complete. Lives in the Layers panel.",
  },
  {
    key: "fusion",
    label: "Fusion",
    state: "active",
    detail: "Every fusion relationship moves, and the Drive dial says how: a continuous loop, an arrival that settles, or discrete bursts. Lives in the Fusion panel.",
  },
]

const selectClass =
  "w-full max-w-64 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-sm"
const fieldLabelClass = "text-[11px] font-medium text-muted-foreground"
const sliderClass = "fs-slider w-56 max-w-full"
const switchClass = "fs-switch"
const pillClass = (active: boolean) =>
  `fs-press select-none rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
    active
      ? "border-foreground/30 bg-foreground/10 text-foreground"
      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
  }`

/* ---- Material panel control (surface + Animated Material v1) ---- */
function MaterialControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const animOn = styleState.materialAnimationEnabled
  const isCustom = styleState.materialPreset === "custom"
  const params = resolveMaterialParams(styleState.materialPreset, styleState.customMaterial)
  const setCustom = (patch: Partial<CustomMaterial>) =>
    setStyleState((s) => ({ ...s, customMaterial: { ...s.customMaterial, ...patch } }))
  return (
    <div className="flex flex-col gap-4">
      <Field k={["materialPreset", "materialUserOverride"]}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Surface preset</span>
          <select
            value={styleState.materialPreset}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                materialPreset: e.target.value as StyleState["materialPreset"],
                // Explicit pick pins the material so mode switches won't override it.
                materialUserOverride: true,
              }))
            }
            className={selectClass}
          >
            {MATERIAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {styleState.materialUserOverride && (
          <button
            type="button"
            onClick={() => setStyleState((s) => ({ ...s, materialUserOverride: false }))}
            className="mb-0.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Stop pinning; follow the per-mode default material again"
          >
            Reset to mode default
          </button>
        )}
      </div>
      </Field>

      {/* Surface readout (real values applied to the preview) + the one button
          that makes the rail obey PRD §6's "editable after selection". Before
          it, the ONLY editable material was `custom`, and `custom` started from
          a fixed grey with no relationship to the preset on screen — so editing
          Soft Gel meant throwing Soft Gel away. Now it forks the live values. */}
      <Field k={"customMaterial"}>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {[
          ["roughness", params.roughness.toFixed(2)],
          ["metalness", params.metalness.toFixed(2)],
          ["clearcoat", params.clearcoat.toFixed(2)],
          ["sheen", params.sheen.toFixed(2)],
        ].map(([k, v]) => (
          <span key={k} className="rounded border border-border bg-muted/30 px-2 py-1 text-muted-foreground">
            {k}: <span className="text-foreground">{v}</span>
          </span>
        ))}
        {!isCustom && (
          <button
            type="button"
            onClick={() =>
              setStyleState((s) => ({
                ...s,
                customMaterial: materialParamsToCustom(
                  resolveMaterialParams(s.materialPreset, s.customMaterial),
                ),
                materialPreset: "custom",
                materialUserOverride: true,
              }))
            }
            title="Open these exact values in the editor. The preset becomes your starting point instead of a dead end."
            className="fs-press select-none rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-material-edit
          >
            Edit these values
          </button>
        )}
      </div>
      </Field>

      {/* Custom Material editor — only when the "Custom…" preset is selected.
          Edits live in styleState.customMaterial and feed resolveMaterialParams,
          so the 3D preview (all modes) updates immediately. */}
      <Field k={"customMaterial"}>
      {isCustom && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
          <span className="text-xs font-medium text-foreground">Custom material</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Color</span>
              <input
                type="color"
                value={styleState.customMaterial.color}
                onChange={(e) => setCustom({ color: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Sheen color</span>
              <input
                type="color"
                value={styleState.customMaterial.sheenColor}
                onChange={(e) => setCustom({ sheenColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Emissive</span>
              <input
                type="color"
                value={styleState.customMaterial.emissive}
                onChange={(e) => setCustom({ emissive: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
          </div>
          {(
            [
              ["Roughness", "roughness", 0, 1, 0.01],
              ["Metalness", "metalness", 0, 1, 0.01],
              ["Clearcoat", "clearcoat", 0, 1, 0.01],
              ["Sheen", "sheen", 0, 1, 0.01],
              ["Emissive", "emissiveIntensity", 0, 2, 0.01],
              ["Reflection", "envMapIntensity", 0, 3, 0.05],
            ] as const
          ).map(([label, key, min, max, step]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className={fieldLabelClass}>
                {label}{" "}
                <span className="text-foreground">{styleState.customMaterial[key].toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={styleState.customMaterial[key]}
                onChange={(e) => setCustom({ [key]: Number(e.target.value) } as Partial<CustomMaterial>)}
                className="fs-slider w-full max-w-sm"
              />
            </label>
          ))}
        </div>
      )}
      </Field>

      {/* Animated Material v1 — preview-only surface animation. */}
      <Field k={["materialAnimationEnabled", "materialAnimationType", "materialAnimationSpeed", "materialAnimationIntensity"]} group>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <Field k={"materialAnimationEnabled"}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={animOn}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                materialAnimationEnabled: e.target.checked,
                materialAnimationType:
                  e.target.checked && s.materialAnimationType === "none"
                    ? "shineSweep"
                    : s.materialAnimationType,
                // Animation needs a running clock; don't silently do nothing.
                // Same line as Texture, Dither, ASCII and Stack Animation.
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className={switchClass}
          />
          <span className="text-xs font-medium text-foreground">Material Animation</span>
          <span
            className="select-none rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            title="Shows live in the 3D preview; not baked into GLB export"
          >
            preview
          </span>
        </label>
        </Field>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <Field k={"materialAnimationType"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Type</span>
            <select
              value={styleState.materialAnimationType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  materialAnimationType: e.target.value as StyleState["materialAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              {MATERIAL_ANIMATION_TYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          </Field>

          <Field k={"materialAnimationSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.materialAnimationSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.materialAnimationSpeed}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, materialAnimationSpeed: Number(e.target.value) }))
              }
              className={sliderClass}
              disabled={!animOn}
            />
          </label>
          </Field>

          <Field k={"materialAnimationIntensity"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Intensity{" "}
              <span className="text-foreground">{Math.round(styleState.materialAnimationIntensity * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={styleState.materialAnimationIntensity}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, materialAnimationIntensity: Number(e.target.value) }))
              }
              className={sliderClass}
              disabled={!animOn}
            />
          </label>
          </Field>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Timing follows the <span className="font-medium text-foreground">Animation</span> panel&apos;s motion
            mode: &ldquo;Sync to Draw&rdquo; ties it to stroke draw-in; otherwise it runs on its own clock.
          </p>
        </div>
      </div>
      </Field>
    </div>
  )
}

/* ---- Shared per-layer timing control (POST_MVP_VISUAL_TIMING_SYSTEM) ----
 * Every animated layer answers the same question — which clock do I ride, and
 * when do I start? Rendering that as one component keeps the three systems
 * consistent and means new sync modes appear everywhere at once. */
function LayerTimingControl({
  label,
  syncMode,
  delay,
  disabled,
  onSync,
  onDelay,
}: {
  label: string
  syncMode: StyleState["textureSyncMode"]
  delay: number
  disabled: boolean
  onSync: (v: StyleState["textureSyncMode"]) => void
  onDelay: (v: number) => void
}) {
  return (
    <div className={`flex flex-col gap-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>{label} timing</span>
        <select
          value={syncMode}
          onChange={(e) => onSync(e.target.value as StyleState["textureSyncMode"])}
          className={selectClass}
          disabled={disabled}
        >
          <option value="independent">Independent, own clock</option>
          <option value="revealSynced">Reveal synced, rides the draw-in</option>
          <option value="strokeTimeSynced">Stroke time, the gesture&apos;s own tempo</option>
          <option value="delayedAfterReveal">After reveal, starts once drawing ends</option>
          <option value="completionPulse">Completion pulse, one-shot burst</option>
          <option value="loopSynced">Loop synced, shared loop</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>
          Delay <span className="text-foreground">{delay.toFixed(1)}s</span>
        </span>
        <input
          type="range"
          min={0}
          max={4}
          step={0.1}
          value={delay}
          onChange={(e) => onDelay(Number(e.target.value))}
          className={sliderClass}
          disabled={disabled}
        />
      </label>
    </div>
  )
}

/* ---- Texture panel: procedural pattern renderer (IMPLEMENTED v1) ----
 * Texture is PATTERN only. It never sets dither (threshold) or ASCII (glyph)
 * state — those are sibling systems with their own panels. */
function TextureControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const texOn = styleState.textureEnabled && styleState.textureMode !== "none"
  const animOn = texOn && styleState.textureAnimated
  // Pulse and Boil have no direction; Travel and Sheen do.
  const texAnimType = styleState.textureAnimationType ?? "travel"
  const texDirectional = TEXTURE_ANIMATION_TYPES.find((t) => t.id === texAnimType)?.directional ?? true
  return (
    <div className="flex flex-col gap-4">
      <Field k={["textureEnabled", "textureMode"]}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Pattern</span>
        <select
          value={texOn ? styleState.textureMode : "none"}
          onChange={(e) => {
            const v = e.target.value as StyleState["textureMode"]
            setStyleState((s) =>
              v === "none"
                ? { ...s, textureEnabled: false, textureMode: "none" }
                : { ...s, textureEnabled: true, textureMode: v },
            )
          }}
          className={selectClass}
        >
          {TEXTURE_MODES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      </Field>

      <div className={`flex flex-col gap-3 ${texOn ? "" : "pointer-events-none opacity-50"}`}>
        <Field k={"textureScale"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Scale <span className="text-foreground">{styleState.textureScale.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.2}
            max={4}
            step={0.05}
            value={styleState.textureScale}
            onChange={(e) => setStyleState((s) => ({ ...s, textureScale: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!texOn}
          />
        </label>
        </Field>

        <Field k={"textureIntensity"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Intensity{" "}
            <span className="text-foreground">{Math.round(styleState.textureIntensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.textureIntensity}
            onChange={(e) => setStyleState((s) => ({ ...s, textureIntensity: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!texOn}
          />
        </label>
        </Field>

        <Field k={"textureContrast"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast{" "}
            <span className="text-foreground">{Math.round(styleState.textureContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.textureContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, textureContrast: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!texOn}
          />
        </label>
        </Field>

        {/* PATTERN OFFSET — the field that state had, the renderer read, and no
            control anywhere could reach.

            `texturePhase` was declared (lib/style-system.ts:340), defaulted to 0
            (:541), listed in the composition rail keys (:4173) and read every
            frame by the viewport (`phase: styleState.texturePhase`,
            components/viewport-3d.tsx:2463) — and grep finds NO writer in the
            app. So `LayerTiming.phase` was 0 on every layer, always, and the
            only way to reach the field was to author a preset by hand.

            MEASURED, on the real page (scripts/verify/_probe-lane28-panel.mjs):
            driving every one of the Texture panel's ten controls left
            texturePhase at 0 — while the same sweep moved textureScale to 3.15
            and textureDelay to 3.1, so the instrument could see writes and there
            were none. Then, with animation OFF and motion mode "off", phase 0
            against phase 3.14159 rendered DIFFERENT bytes: the field is live,
            so the honest fix is to expose it rather than delete it.

            IT SITS HERE, NOT IN THE ANIMATION BLOCK. `evaluateLayerTime` adds
            `phase` in every branch INCLUDING `resting(phase)`
            (lib/style-clock.ts:321), so it applies with the animation off. A
            live control gated behind an unrelated switch is the same defect in
            a new place. */}
        <Field k={"texturePhase"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Pattern offset{" "}
            <span className="text-foreground">{styleState.texturePhase.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={6.28}
            step={0.02}
            value={styleState.texturePhase}
            onChange={(e) => setStyleState((s) => ({ ...s, texturePhase: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!texOn}
            data-texture-phase
          />
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Slides the pattern along its own travel axis. Works with the animation off. And when
            it is on, this is where the motion starts from.
          </span>
        </label>
        </Field>

        <Field k={"textureLockMode"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.textureLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                textureLockMode: e.target.value as StyleState["textureLockMode"],
              }))
            }
            className={selectClass}
            disabled={!texOn}
          >
            <option value="object">Object (sticks to the form)</option>
            <option value="screen">Screen (graphic overlay)</option>
          </select>
        </label>
        </Field>
      </div>

      {/* Animated texture — PATTERN MOTION only. */}
      <Field k={["textureAnimated", "textureAnimationType", "textureSpeed", "textureDirection", "textureSyncMode", "textureDelay"]} group>
      <div className="border-t border-border pt-3">
        <Field k={"textureAnimated"}>
        <label className={`flex items-center gap-2 ${texOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.textureAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                textureAnimated: e.target.checked,
                // Animation needs a running clock; don't silently do nothing.
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className={switchClass}
            disabled={!texOn}
          />
          <span className="text-xs font-medium text-foreground">Texture Animation</span>
        </label>
        </Field>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <Field k={"textureAnimationType"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Behaviour</span>
            <select
              value={texAnimType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  textureAnimationType: e.target.value as StyleState["textureAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              {TEXTURE_ANIMATION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          </Field>

          <Field k={"textureSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.textureSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.textureSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, textureSpeed: Number(e.target.value) }))}
              className={sliderClass}
              disabled={!animOn}
            />
          </label>
          </Field>

          <Field k={"textureDirection"}>
          <label className={`flex flex-col gap-1 ${texDirectional ? "" : "opacity-50"}`}>
            <span className={fieldLabelClass}>Direction</span>
            <select
              value={styleState.textureDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  textureDirection: e.target.value as StyleState["textureDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn || !texDirectional}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="diagonal">Diagonal</option>
            </select>
          </label>
          </Field>

          <Field k={["textureSyncMode", "textureDelay"]}>
          <LayerTimingControl
            label="Texture"
            syncMode={styleState.textureSyncMode}
            delay={styleState.textureDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, textureSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, textureDelay: v }))}
          />
          </Field>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Pattern motion only. Timing follows the{" "}
            <span className="font-medium text-foreground">Animation</span> panel&apos;s motion mode:
            &ldquo;Sync to Draw&rdquo; plays the behaviour with the reveal.
          </p>
        </div>
      </div>
      </Field>
    </div>
  )
}

/* ---- Dither panel: threshold renderer (IMPLEMENTED v1) ----
 * Dither is TONAL REDUCTION through a threshold map — a different system from
 * Texture (surface pattern) and ASCII (glyphs). It writes only dither* state. */
function DitherControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const ditOn = styleState.ditherEnabled
  const animOn = ditOn && styleState.ditherAnimated
  return (
    <div className="flex flex-col gap-4">
      <Field k={["ditherEnabled", "ditherType"]}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Threshold map</span>
        <select
          value={ditOn ? styleState.ditherType : "off"}
          onChange={(e) => {
            const v = e.target.value
            setStyleState((s) =>
              v === "off"
                ? { ...s, ditherEnabled: false }
                : { ...s, ditherEnabled: true, ditherType: v as StyleState["ditherType"] },
            )
          }}
          className={selectClass}
        >
          <option value="off">Off</option>
          <option value="bayer4">Bayer 4×4 (ordered)</option>
          <option value="bayer8">Bayer 8×8 (finer ordered)</option>
          <option value="blueNoise">Noise threshold (IGN)</option>
          <option value="halftone">Halftone dots</option>
          <option value="lines">Lines</option>
          <option value="dotScreen">Dot screen (angled print)</option>
          <option value="hatch">Hatch (angled lines)</option>
          <option value="crosshatch">Crosshatch (engraving)</option>
          <option value="diamond">Diamond dots</option>
          <option value="newsprint">Newsprint (grainy dot)</option>
        </select>
      </label>
      </Field>

      <div className={`flex flex-col gap-3 ${ditOn ? "" : "pointer-events-none opacity-50"}`}>
        <Field k={"ditherScale"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Cell size <span className="text-foreground">{styleState.ditherScale.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={styleState.ditherScale}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherScale: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
        </label>
        </Field>

        <Field k={"ditherLevels"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Tone levels <span className="text-foreground">{styleState.ditherLevels}</span>
          </span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={styleState.ditherLevels}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherLevels: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
          <span className="text-[10px] text-muted-foreground">2 = pure two-tone; higher keeps more shading.</span>
        </label>
        </Field>

        <Field k={"ditherThreshold"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Threshold bias{" "}
            <span className="text-foreground">{Math.round(styleState.ditherThreshold * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.15}
            max={0.85}
            step={0.01}
            value={styleState.ditherThreshold}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherThreshold: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
        </label>
        </Field>

        <Field k={"ditherContrast"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast <span className="text-foreground">{Math.round(styleState.ditherContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.ditherContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherContrast: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
        </label>
        </Field>

        <Field k={"ditherExposure"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Exposure <span className="text-foreground">{Math.round(styleState.ditherExposure * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.ditherExposure}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherExposure: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
          <span className="text-[10px] text-muted-foreground">
            Maps the subject&rsquo;s real tonal range onto the pattern. Raise it for dark ink materials.
          </span>
        </label>
        </Field>

        <Field k={"ditherAngle"}>
        {["dotScreen", "hatch", "crosshatch", "diamond", "newsprint"].includes(
          styleState.ditherType,
        ) && (
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Screen angle <span className="text-foreground">{styleState.ditherAngle}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={styleState.ditherAngle}
              onChange={(e) => setStyleState((s) => ({ ...s, ditherAngle: Number(e.target.value) }))}
              className={sliderClass}
              disabled={!ditOn}
            />
            <span className="text-[10px] text-muted-foreground">45° is the classic single-ink print angle.</span>
          </label>
        )}
        </Field>

        <Field k={"ditherIntensity"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Amount <span className="text-foreground">{Math.round(styleState.ditherIntensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.ditherIntensity}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherIntensity: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ditOn}
          />
          <span className="text-[10px] text-muted-foreground">Blend between smooth shading and full dither.</span>
        </label>
        </Field>

        <Field k={"ditherLockMode"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.ditherLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                ditherLockMode: e.target.value as StyleState["ditherLockMode"],
              }))
            }
            className={selectClass}
            disabled={!ditOn}
          >
            <option value="screen">Screen (classic graphic dither)</option>
            <option value="object">Object (grid sticks to the form)</option>
          </select>
        </label>
        </Field>
      </div>

      {/* Animated dither — THRESHOLD MOTION. */}
      <Field k={["ditherAnimated", "ditherSpeed", "ditherDirection", "ditherSyncMode", "ditherDelay"]} group>
      <div className="border-t border-border pt-3">
        <Field k={"ditherAnimated"}>
        <label className={`flex items-center gap-2 ${ditOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.ditherAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                ditherAnimated: e.target.checked,
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className={switchClass}
            disabled={!ditOn}
          />
          <span className="text-xs font-medium text-foreground">Dither Animation</span>
        </label>
        </Field>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <Field k={"ditherSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.ditherSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.ditherSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, ditherSpeed: Number(e.target.value) }))}
              className={sliderClass}
              disabled={!animOn}
            />
          </label>
          </Field>

          <Field k={"ditherDirection"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Motion</span>
            <select
              value={styleState.ditherDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  ditherDirection: e.target.value as StyleState["ditherDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              <option value="static">Threshold sweep (no travel)</option>
              <option value="horizontal">Matrix crawl, horizontal</option>
              <option value="vertical">Matrix crawl, vertical</option>
              <option value="diagonal">Matrix crawl, diagonal</option>
            </select>
          </label>
          </Field>

          <Field k={["ditherSyncMode", "ditherDelay"]}>
          <LayerTimingControl
            label="Dither"
            syncMode={styleState.ditherSyncMode}
            delay={styleState.ditherDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, ditherSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, ditherDelay: v }))}
          />
          </Field>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Threshold motion, not pattern motion. &ldquo;Threshold sweep&rdquo; oscillates the bias so tone
            opens and closes in place; the crawl options travel the matrix. With{" "}
            <span className="font-medium text-foreground">Sync to Draw</span> the threshold opens as the
            stroke reveals.
          </p>
        </div>
      </div>
      </Field>
    </div>
  )
}

/* ---- ASCII panel: glyph renderer (IMPLEMENTED v1) ----
 * ASCII is the THIRD system: character glyphs, distinct from Texture (pattern)
 * and Dither (threshold). It writes only ascii* state. */
function AsciiControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const ascOn = styleState.asciiEnabled
  const animOn = ascOn && styleState.asciiAnimated
  const travels =
    styleState.asciiAnimationType === "scroll" || styleState.asciiAnimationType === "rain"
  return (
    <div className="flex flex-col gap-4">
      <Field k={["asciiEnabled", "asciiCharset"]}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Character set</span>
        <select
          value={ascOn ? styleState.asciiCharset : "off"}
          onChange={(e) => {
            const v = e.target.value
            setStyleState((s) =>
              v === "off"
                ? { ...s, asciiEnabled: false }
                : { ...s, asciiEnabled: true, asciiCharset: v as StyleState["asciiCharset"] },
            )
          }}
          className={selectClass}
        >
          <option value="off">Off</option>
          <option value="classic">Classic .:-=+*#%@</option>
          <option value="blocks">Blocks ░▒▓█</option>
          <option value="minimal">Binary 0 1</option>
          <option value="dots">Dots</option>
          <option value="custom">Code marks / &lt; &gt; [ &#123;</option>
          <option value="braille">Braille cells</option>
          <option value="boxes">Box lines │ ┼ ▦</option>
          <option value="arrows">Arrows ^ / \ ×</option>
          <option value="punct">Punctuation &apos; ! ? &amp; $</option>
          <option value="numeric">Numerals 1 7 3 … 8</option>
        </select>
      </label>
      </Field>

      <div className={`flex flex-col gap-3 ${ascOn ? "" : "pointer-events-none opacity-50"}`}>
        <Field k={"asciiCellSize"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Cell size <span className="text-foreground">{styleState.asciiCellSize}px</span>
          </span>
          <input
            type="range"
            min={4}
            max={24}
            step={1}
            value={styleState.asciiCellSize}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiCellSize: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ascOn}
          />
        </label>
        </Field>

        <Field k={"asciiDensity"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Density <span className="text-foreground">{Math.round(styleState.asciiDensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.asciiDensity}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiDensity: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ascOn}
          />
          <span className="text-[10px] text-muted-foreground">Biases the ramp toward sparser or denser characters.</span>
        </label>
        </Field>

        <Field k={"asciiContrast"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast <span className="text-foreground">{Math.round(styleState.asciiContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.asciiContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiContrast: Number(e.target.value) }))}
            className={sliderClass}
            disabled={!ascOn}
          />
        </label>
        </Field>

        <Field k={"asciiLockMode"}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.asciiLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                asciiLockMode: e.target.value as StyleState["asciiLockMode"],
              }))
            }
            className={selectClass}
            disabled={!ascOn}
          >
            <option value="screen">Screen (terminal grid)</option>
            <option value="object">Object (grid sticks to the form)</option>
          </select>
        </label>
        </Field>
      </div>

      {/* Animated ASCII — GLYPH MOTION. */}
      <Field k={["asciiAnimated", "asciiAnimationType", "asciiScrollSpeed", "asciiDirection", "asciiSyncMode", "asciiDelay"]} group>
      <div className="border-t border-border pt-3">
        <Field k={"asciiAnimated"}>
        <label className={`flex items-center gap-2 ${ascOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.asciiAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                asciiAnimated: e.target.checked,
                asciiAnimationType:
                  e.target.checked && s.asciiAnimationType === "none" ? "scroll" : s.asciiAnimationType,
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className={switchClass}
            disabled={!ascOn}
          />
          <span className="text-xs font-medium text-foreground">ASCII Animation</span>
        </label>
        </Field>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <Field k={"asciiAnimationType"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Behaviour</span>
            <select
              value={styleState.asciiAnimationType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  asciiAnimationType: e.target.value as StyleState["asciiAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              <option value="scroll">Scroll, the grid travels</option>
              <option value="rain">Rain, columns fall independently</option>
              <option value="cycle">Cycle, glyphs change in place</option>
              <option value="flicker">Flicker, random cells jump</option>
              <option value="revealDensity">Reveal, density grows with draw-in</option>
            </select>
          </label>
          </Field>

          <Field k={"asciiScrollSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.asciiScrollSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.asciiScrollSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, asciiScrollSpeed: Number(e.target.value) }))}
              className={sliderClass}
              disabled={!animOn}
            />
          </label>
          </Field>

          <Field k={"asciiDirection"}>
          <label className={`flex flex-col gap-1 ${travels ? "" : "opacity-50"}`}>
            <span className={fieldLabelClass}>Direction</span>
            <select
              value={styleState.asciiDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  asciiDirection: e.target.value as StyleState["asciiDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn || !travels}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="static">None</option>
            </select>
            {!travels && (
              <span className="text-[10px] text-muted-foreground">
                Only Scroll and Rain travel; the others change glyphs in place.
              </span>
            )}
          </label>
          </Field>

          <Field k={["asciiSyncMode", "asciiDelay"]}>
          <LayerTimingControl
            label="ASCII"
            syncMode={styleState.asciiSyncMode}
            delay={styleState.asciiDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, asciiSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, asciiDelay: v }))}
          />
          </Field>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Glyph motion, not pattern motion (Texture) or threshold motion (Dither). With{" "}
            <span className="font-medium text-foreground">Sync to Draw</span> the motion rides the
            stroke reveal.
          </p>
        </div>
      </div>
      </Field>
    </div>
  )
}

/* ---- Layers panel: the stack compositor (IMPLEMENTED v1) ----
 * Composition-level controls: how strongly each layer lands, how it blends, and
 * (for the two post-lighting layers) which runs first. Texture is shown as the
 * base because it is part of the SURFACE — it modulates albedo and roughness
 * before lighting — so it genuinely cannot be reordered above the others
 * without rendering the material twice. Offering a control that silently does
 * nothing would be worse than saying so. */
function LayersControl({
  styleState,
  setStyleState,
  onSelectPreset,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
}) {
  const on = styleState.layerStackEnabled
  const blendOptions = (
    <>
      <option value="normal">Normal</option>
      <option value="multiply">Multiply (darken only)</option>
      <option value="screen">Screen (lighten only)</option>
    </>
  )
  const row = (
    label: string,
    active: boolean,
    opacity: number,
    onOpacity: (v: number) => void,
    blend?: { value: StyleState["stackDitherBlend"]; onChange: (v: StyleState["stackDitherBlend"]) => void },
  ) => (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {active ? "in stack" : "off"}
        </span>
      </div>
      <div className={`mt-2 flex flex-col gap-2 ${active && on ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Opacity <span className="text-foreground">{Math.round(opacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
            className={sliderClass}
            disabled={!active || !on}
          />
        </label>
        {blend ? (
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Blend</span>
            <select
              value={blend.value}
              onChange={(e) => blend.onChange(e.target.value as StyleState["stackDitherBlend"])}
              className={selectClass}
              disabled={!active || !on}
            >
              {blendOptions}
            </select>
          </label>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Base layer. Part of the surface, so it has no blend of its own.
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <Field k={"layerStackEnabled"}>
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setStyleState((s) => ({ ...s, layerStackEnabled: e.target.checked }))}
            className={switchClass}
          />
          <span className="text-xs font-medium text-foreground">Layer stack</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {on ? "active" : "off"}
          </span>
        </label>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Composes the visual systems. Each layer keeps its own controls in its own panel; the stack
          adds opacity, blend, and order on top. With the stack off, every layer behaves exactly as it
          does on its own.
        </p>
      </div>
      </Field>

      <div className={`flex flex-col gap-2 ${on ? "" : "pointer-events-none opacity-50"}`}>
        <Field k={"stackTextureOpacity"}>
        {row(
          "1 · Texture (base)",
          styleState.textureEnabled && styleState.textureMode !== "none",
          styleState.stackTextureOpacity,
          (v) => setStyleState((s) => ({ ...s, stackTextureOpacity: v })),
        )}
        </Field>
        <Field k={["stackDitherOpacity", "stackDitherBlend"]}>
        {row(
          "2 · Dither",
          styleState.ditherEnabled,
          styleState.stackDitherOpacity,
          (v) => setStyleState((s) => ({ ...s, stackDitherOpacity: v })),
          {
            value: styleState.stackDitherBlend,
            onChange: (v) => setStyleState((s) => ({ ...s, stackDitherBlend: v })),
          },
        )}
        </Field>
        <Field k={["stackAsciiOpacity", "stackAsciiBlend"]}>
        {row(
          "3 · ASCII",
          styleState.asciiEnabled,
          styleState.stackAsciiOpacity,
          (v) => setStyleState((s) => ({ ...s, stackAsciiOpacity: v })),
          {
            value: styleState.stackAsciiBlend,
            onChange: (v) => setStyleState((s) => ({ ...s, stackAsciiBlend: v })),
          },
        )}
        </Field>

        <Field k={"stackOrder"}>
        <label className="mt-1 flex flex-col gap-1">
          <span className={fieldLabelClass}>Order (post-lighting layers)</span>
          <select
            value={styleState.stackOrder}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, stackOrder: e.target.value as StyleState["stackOrder"] }))
            }
            className={selectClass}
            disabled={!on}
          >
            <option value="ditherFirst">Dither → ASCII (crisper, printed)</option>
            <option value="asciiFirst">ASCII → Dither (grittier, degraded)</option>
          </select>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Dither first means characters are chosen from already-quantized tone. ASCII first means the
            dither breaks up the character shapes themselves. Texture is always the base.
          </span>
        </label>
        </Field>
      </div>

      {/* Stack-level animation: the GROUP animates as one container. */}
      <Field k={["stackAnimationEnabled", "stackAnimationOpacity", "stackAnimationType", "stackAnimationSpeed", "stackAnimationPhase"]} group>
      <div className={`border-t border-border pt-3 ${on ? "" : "pointer-events-none opacity-50"}`}>
        <Field k={"stackAnimationEnabled"}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={styleState.stackAnimationEnabled}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                stackAnimationEnabled: e.target.checked,
                stackAnimationType:
                  e.target.checked && s.stackAnimationType === "none" ? "fadeIn" : s.stackAnimationType,
                /* THE CLOCK LINE — THE FOURTH PLACE THIS IDEA LIVES, AND THE
                 * ONE IT WAS MISSING FROM.
                 *
                 * Texture Animation, Dither Animation and ASCII Animation each
                 * start the shared clock when they are switched on, each with
                 * the same one-line comment: "Animation needs a running clock;
                 * don't silently do nothing." `createFusion` does it a fourth
                 * time. Stack Animation — the switch that arms the whole GROUP,
                 * eight behaviours plus speed, direction and phase — did not.
                 *
                 * It was harmless until the stack was gated on `motionMode`:
                 * `stackAnimOn` now requires `motionMode !== "off"`
                 * (components/viewport-3d.tsx:2465), which was itself a defect
                 * fix — the group had been ignoring the only motion control the
                 * panel offers. `DEFAULT_STYLE_STATE.motionMode` is `"off"`, so
                 * after that fix, flipping this switch on a FRESH PAGE armed a
                 * group animation with no clock to run on and changed nothing.
                 * The viewport's own comment names this exact case: "picking
                 * 'Stack Drift' off the rail on a fresh page is exactly the
                 * broken case."
                 *
                 * Additive, like its three siblings: it only ever moves "off"
                 * to "independent", so a user who has chosen Sync to Draw keeps
                 * it. */
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className={switchClass}
            disabled={!on}
          />
          <span className="text-xs font-medium text-foreground">Stack Animation</span>
        </label>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Animates the whole group as one container. Different from each layer animating on its own. This moves them together, so the composition&apos;s balance is preserved.
        </p>
        </Field>

        {/* GROUP OPACITY sits OUTSIDE the animation gate on purpose: it is the
            container's own level, not motion, so it has to keep applying when
            the group is not animating. Resolved in resolveStack (lib/style-stack.ts). */}
        <Field k={"stackAnimationOpacity"}>
        <label className="mt-3 flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Group opacity{" "}
            <span className="text-foreground">{styleState.stackAnimationOpacity.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.stackAnimationOpacity}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, stackAnimationOpacity: Number(e.target.value) }))
            }
            className={sliderClass}
            disabled={!on}
          />
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            One level for the whole container, multiplied into every layer at once. The group&apos;s
            own opacity, not a fourth per-layer slider. Works with the animation off.
          </span>
        </label>
        </Field>

        <div
          className={`mt-3 flex flex-col gap-3 ${
            on && styleState.stackAnimationEnabled ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <Field k={"stackAnimationType"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Behaviour</span>
            <select
              value={styleState.stackAnimationType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  stackAnimationType: e.target.value as StyleState["stackAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!on || !styleState.stackAnimationEnabled}
            >
              <option value="fadeIn">Fade in, the stack arrives</option>
              <option value="pulse">Pulse, the whole stack breathes</option>
              <option value="drift">Drift, every layer slides together</option>
              <option value="delayAfterReveal">Delay, lands after the form is drawn</option>
              <option value="completionPulse">Completion pulse, swell at the end</option>
              <option value="freezeOnComplete">Freeze on complete, hold the final frame</option>
              <option value="loop">Loop, out and back on the shared loop</option>
              <option value="revealSynced">Reveal track, builds with the stroke</option>
            </select>
            {styleState.stackAnimationType === "revealSynced" && (
              <span className="text-[10px] leading-relaxed text-muted-foreground">
                Driven by the draw-in playhead, so on a finished stroke it sits at full strength. Replay the draw to see it build.
              </span>
            )}
          </label>
          </Field>
          {/* SPEED IS THE MAGNITUDE, DIRECTION IS THE SIGN — one signed state
              field, two controls, because the group's motion is a single scalar
              phase offset and a second multiplying dial would be two names for
              one lever. See `stackAnimationSpeed` in lib/style-system.ts. */}
          <Field k={"stackAnimationSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed{" "}
              <span className="text-foreground">
                {Math.abs(styleState.stackAnimationSpeed).toFixed(2)}×
              </span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={Math.abs(styleState.stackAnimationSpeed)}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  stackAnimationSpeed:
                    Number(e.target.value) * (s.stackAnimationSpeed < 0 ? -1 : 1),
                }))
              }
              className={sliderClass}
              disabled={!on || !styleState.stackAnimationEnabled}
            />
          </label>
          </Field>
          {/* Direction only means something where the behaviour produces a
              shared OFFSET. On the amplitude behaviours it is disabled rather
              than hidden — a dial that vanishes is a dial you forget exists
              (the same rule the Inflate strip follows for Blend/Resolution). */}
          <Field k={"stackAnimationSpeed"}>
          {(() => {
            const dirLive =
              styleState.stackAnimationType === "drift" ||
              styleState.stackAnimationType === "loop" ||
              styleState.stackAnimationType === "revealSynced"
            const reversed = styleState.stackAnimationSpeed < 0
            const setDir = (rev: boolean) =>
              setStyleState((s) => ({
                ...s,
                stackAnimationSpeed: Math.abs(s.stackAnimationSpeed) * (rev ? -1 : 1),
              }))
            return (
              <label className="flex flex-col gap-1">
                <span className={fieldLabelClass}>Direction</span>
                <div className="flex gap-1.5">
                  {([
                    { rev: false, label: "Forward" },
                    { rev: true, label: "Reverse" },
                  ] as const).map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setDir(d.rev)}
                      disabled={!on || !styleState.stackAnimationEnabled || !dirLive}
                      aria-pressed={reversed === d.rev}
                      className={`${pillClass(reversed === d.rev)} ${
                        dirLive ? "" : "cursor-not-allowed opacity-45"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] leading-relaxed text-muted-foreground">
                  {dirLive
                    ? "Which way the whole stack slides."
                    : "Only Drift, Loop and Reveal track produce a shared slide, so direction has nothing to reverse here."}
                </span>
              </label>
            )
          })()}
          </Field>
          {/* PHASE — the field existed in state and was read by the engine, and
              nothing in the UI had ever exposed it, so the only way to reach it
              was to author a preset. Live on the three behaviours that read it;
              dragging it visibly scrubs the group's cycle. */}
          <Field k={"stackAnimationPhase"}>
          {(() => {
            const phaseLive =
              styleState.stackAnimationType === "pulse" ||
              styleState.stackAnimationType === "drift" ||
              styleState.stackAnimationType === "loop" ||
              styleState.stackAnimationType === "revealSynced"
            return (
              <label className="flex flex-col gap-1">
                <span className={fieldLabelClass}>
                  Phase offset{" "}
                  <span className="text-foreground">{styleState.stackAnimationPhase.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={6.28}
                  step={0.02}
                  value={styleState.stackAnimationPhase}
                  onChange={(e) =>
                    setStyleState((s) => ({ ...s, stackAnimationPhase: Number(e.target.value) }))
                  }
                  className={sliderClass}
                  disabled={!on || !styleState.stackAnimationEnabled || !phaseLive}
                />
                <span className="text-[10px] leading-relaxed text-muted-foreground">
                  {phaseLive
                    ? "Where in its cycle the group sits. Two presets on the same behaviour use it so they do not share a frame zero."
                    : "Fade in, Delay, Completion pulse and Freeze have no cycle to offset."}
                </span>
              </label>
            )
          })()}
          </Field>
          <Field k={[]}>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_REGISTRY.stackAnimation.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset("stackAnimation", p.id)}
                className={pillClass(styleState.activePresetId === p.id)}
                title={p.description}
              >
                {p.label}
              </button>
            ))}
          </div>
          </Field>
        </div>
      </div>
      </Field>

      <Field k={[]}>
      <div className="border-t border-border pt-3">
        <span className={fieldLabelClass}>Stack presets</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESET_REGISTRY.layerStack.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset("layerStack", p.id)}
              className={pillClass(styleState.activePresetId === p.id)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Each preset is a composition, not a pile of switches: one dominant layer, the others
          supporting at reduced opacity.
        </p>
      </div>
      </Field>
    </div>
  )
}

/* ---- Fusion panel: relationships between systems (PRD phases 20/21) ----
 *
 * WHAT CHANGED HERE, AND WHY IT IS NOT A COSMETIC EDIT.
 *
 * This panel used to show two rows of pills — eight "Fusion preset" pills and
 * seven "Animated fusion" pills — plus one Intensity slider. Every part of that
 * mis-described what the code does, and it was measurable:
 *
 *   1. The two rows implied static vs animated. All eight "static" presets
 *      animate (11.9-769.8 path units of late-window motion, measured at 120 Hz
 *      on the real page), so the first row was a row of animated presets labelled
 *      as if it were not.
 *   2. Five of the seven "animated" pills produced LESS steady-state motion than
 *      their sibling and one (Code Bloom Character Reveal) produced exactly none.
 *      A pill promising motion and delivering a frozen frame.
 *   3. Fifteen pills described eight looks. The second row was not a set of
 *      options; it was the first row again with one field changed — which is why
 *      one preset (Pixel Clay) simply had no partner and nothing said so.
 *   4. Intensity's copy said "how deeply the systems drive each other", but the
 *      dial also scaled every drive's amplitude, so on five of eight presets it
 *      was the difference between a moving picture and a still one, and on the
 *      other three it was not, because those animate their own layers.
 *
 * So: ONE row of eight preset pills (the eight looks), and the time behaviour
 * becomes a DRIVE dial in the config area beneath them — customisation belongs in
 * dials, not in a second row of top-level pills. The named combinations still
 * exist in PRESET_REGISTRY.animatedFusion and caption the panel; nothing was
 * taken away, and the matrix went from 8 x 2 with a hole to 8 x 3 complete.
 */
const FUSION_DRIVES: { id: FusionDrive; label: string; blurb: string }[] = [
  {
    id: "loop",
    label: "Loop",
    blurb: "The relationship runs continuously, on its own rhythm. Never stops.",
  },
  {
    id: "arc",
    label: "Arc",
    blurb:
      "It ARRIVES with the draw, and on selection too, so it plays on a finished stroke. Then it settles into a quieter loop.",
  },
  {
    id: "burst",
    label: "Burst",
    blurb: "It rests, and fires on discrete events. The coupling reads as impulses, not a breath.",
  },
]

/* ---- USER-AUTHORED FUSION: the authoring surface ------------------------
 *
 * WHY THIS IS HERE AND NOT IN A "SAVE PRESET" BUTTON.
 *
 * PRD §4: *"Fusion defines RELATIONSHIPS, not just a saved slider state. A
 * fusion preset needs a concept."* So the thing a user authors is not "the
 * current dials, bottled" — it is a list of sentences of the form SOURCE drives
 * TARGET by AMOUNT, which is exactly what the eight built-ins are made of. Two
 * dropdowns and a slider per relationship, and the panel reads the whole set
 * back in plain English so the CONCEPT is visible, not just the wiring.
 *
 * IT EDITS LIVE. There is no Save button and no dirty state: the library IS
 * style state, so dragging a link's amount moves the picture under the cursor
 * and app/page.tsx persists the library. A save button here would add a mode, a
 * failure case ("did that save?"), and nothing a user wants.
 *
 * A LINK WHOSE LAYER IS OFF IS CALLED OUT, NOT HIDDEN. "ASCII field drives
 * dither threshold" with ASCII disabled is a control that does not visibly act
 * — the exact defect class this repo keeps shipping. So the row says so and
 * offers the one click that fixes it, rather than leaving the user to conclude
 * the feature is broken.
 */
/* ⚠ THIS FILE USED TO OWN THE ANSWER TO "IS THIS LINK AWAKE", AND THAT IS WHY
 * NOBODY COULD MEASURE THE DEFECT SEBS HIT.
 *
 * Five predicates lived here — `layerIsOn`, `animOn`, `animatePatch`,
 * `enableLayerPatch` and the inline `asleep` list. They were correct. They were
 * also invisible to every gate in the repo, because they were React. So the one
 * question that decides whether the whole feature does anything — *is this
 * relationship carrying a signal right now* — had no answer outside a browser,
 * and the answer it did have (measured 2026-08-03: a brand-new fusion's first
 * seed link contributed EXACTLY 0.000000) went unnoticed for a cycle.
 *
 * They now live in lib/style-fusion.ts as `fusionLinkSleep` / `fusionWakePatch`,
 * next to the engine whose behaviour they describe, so the panel that WARNS, the
 * button that FIXES and the gate that CHECKS all read one definition. */

/**
 * The one-click cure for each sleep reason, and its label.
 *
 * The PATCH itself is the model's (`fusionWakePatch` derives it from the link),
 * so this table is only the wording — a fix that says "Turn on Dither" and then
 * patches something else is the exact defect the previous version shipped, and
 * it cannot happen when the same function produces both.
 */
function fixLabel(fix: FusionFixKey): string {
  if (fix === "material") return "Use Soft Gel"
  if (fix === "ditherDirection") return "Give Dither a direction"
  const [kind, layer] = fix.split(":") as [
    "layer" | "anim",
    "texture" | "dither" | "ascii" | "stack",
  ]
  const name = layer === "ascii" ? "ASCII" : layer === "stack" ? "the Layer stack" : layer[0].toUpperCase() + layer.slice(1)
  return kind === "anim" ? `Animate ${name}` : `Turn on ${name}`
}

/**
 * WHAT THIS LINK IS DOING RIGHT NOW, written straight into the DOM.
 *
 * The panel could say why a link was ASLEEP and had no way to say one was
 * AWAKE, so a working relationship and a dead one looked identical and the only
 * way to tell them apart was to stare at the mark. This is the positive half.
 *
 * NO REACT STATE, DELIBERATELY. The 2026-08-02 performance pass measured React
 * re-rendering the whole page every animation frame and costing 3.3x what
 * three.js did, with the `Pill` component burning 70.8 ms during playback and
 * 0 ms idle. A `setState` per frame here would put the fusion editor straight
 * back into that hole. The rAF writes `textContent` and one width, which touches
 * no component and no reconciler, and it stops the moment the row unmounts.
 */
function useLinkMeter(
  fusionId: string,
  linkId: string,
): { num: React.RefObject<HTMLSpanElement | null>; bar: React.RefObject<HTMLSpanElement | null> } {
  const num = useRef<HTMLSpanElement | null>(null)
  const bar = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    let raf = 0
    let lastTick = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      // A readout belonging to a DIFFERENT fusion, or one that has stopped
      // advancing, is stale — show a dash rather than a stale number, which is
      // the whole reason `tick` is published.
      const live = FUSION_READOUT.id === fusionId && FUSION_READOUT.tick !== lastTick
      lastTick = FUSION_READOUT.tick
      const v = live ? (FUSION_READOUT.drive[linkId] ?? 0) : NaN
      if (num.current) num.current.textContent = Number.isFinite(v) ? v.toFixed(2) : "·"
      if (bar.current) {
        const mag = Number.isFinite(v) ? Math.min(1, Math.abs(v)) : 0
        bar.current.style.width = `${(mag * 100).toFixed(0)}%`
        bar.current.style.opacity = mag < 0.02 ? "0.25" : "1"
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fusionId, linkId])
  return { num, bar }
}

function FusionLinkRow({
  link,
  fusionId,
  styleState,
  setStyleState,
  onPatch,
  onRemove,
  canRemove,
  cameraSpin,
  onSpin,
}: {
  link: FusionLink
  fusionId: string
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onPatch: (patch: Partial<FusionLink>) => void
  onRemove: () => void
  canRemove: boolean
  /** Degrees per second the turntable is running. The model cannot know this —
   *  the camera is not style state — so the one caller that CAN see it tells it,
   *  and `undefined` stays silent rather than manufacturing a sleep reason. */
  cameraSpin: number
  onSpin: (deg: number) => void
}) {
  const srcDef = FUSION_SOURCES.find((s) => s.id === link.source)!
  const tgtDef = FUSION_TARGETS.find((t) => t.id === link.target)!
  /* EVERY REASON THIS SPECIFIC ROW MIGHT NOT MOVE A PIXEL, NAMED — and the list
   * is the MODEL's now (`fusionLinkSleep`), not this file's. It was computed
   * here, which meant no gate could ask it and the newborn-fusion no-op went
   * unmeasured; see the note above `fixLabel`.
   *
   * ⚠ A FIX IS KEYED BY WHAT IT DOES *AND* TO WHICH LAYER, and it was keyed by
   * only half of that. Two defects fell out of the missing half, both MEASURED
   * on the real panel (scripts/verify/_probe-lane28-panel.mjs):
   *
   *  1. THE BUTTON NAMED THE WRONG LAYER AND THEN FIXED THE WRONG LAYER.
   *     `animNeed` was `srcDef.needsAnim ?? tgtDef.needsAnim` — the SOURCE won
   *     whenever it had one, even when the source was animating perfectly and
   *     it was the TARGET that was asleep.
   *
   *  2. TWO IDENTICAL BUTTONS AND A REACT KEY COLLISION. With one layer needed
   *     at BOTH ends — `ditherField drives ditherThreshold`, dither off — both
   *     pushes carried `fix: "dither"`, so the row rendered
   *     ["Turn on Dither", "Turn on Dither"] and React logged
   *     "Encountered two children with the same key".
   *
   * The key encodes the layer, so it is unique by construction. */
  const asleep = fusionLinkSleep(
    { ...link },
    { ...styleState, cameraSpinDegPerSecond: cameraSpin },
    resolveFusionDrive(styleState),
  )
  const meter = useLinkMeter(fusionId, link.id)

  /* THE FIX AND THE WORDS FOR IT COME FROM ONE PLACE, and each button does
   * ONLY what it says. `fusionFixPatch` is keyed by the same `FusionFixKey` the
   * warning carried, so a button labelled "Animate ASCII" cannot patch Texture
   * (defect 1 above, made unreachable rather than corrected) and three buttons
   * on one row cannot all secretly do the same thing. */
  /* `view:spin` is the one fix that is NOT style state — the camera belongs to
   * the viewport — so it routes to the caller that owns the viewport API instead
   * of through the patch. `fusionFixPatch` returns an empty patch for it on
   * purpose; applying that and calling it done would be a button that does
   * nothing under a label that says it does something. */
  const applyFix = (fix: FusionFixKey) => {
    if (fix === "view:spin") {
      onSpin(FUSION_VIEW_SPIN_DEG)
      return
    }
    setStyleState((s) => ({ ...s, ...fusionFixPatch(fix, s) }))
  }
  /* One button per DISTINCT fix, in first-seen order. Two reasons can share a
   * cure (a layer needed at both ends), and offering the same cure twice is
   * what produced the duplicate-key warning. */
  const fixes = [...new Set(asleep.map((a) => a.fix).filter((f): f is FusionFixKey => !!f))]

  return (
    <div className="rounded-md border border-border bg-background/60 px-2 py-1.5" data-fusion-link={link.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={link.source}
          onChange={(e) => onPatch({ source: e.target.value as FusionSourceId })}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-[11px] text-foreground"
          title={srcDef.blurb}
          aria-label="Source"
          data-fusion-link-source={link.id}
        >
          {FUSION_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="select-none text-[10px] uppercase tracking-wider text-muted-foreground">drives</span>
        <select
          value={link.target}
          onChange={(e) => onPatch({ target: e.target.value as FusionTargetId })}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-[11px] text-foreground"
          title={tgtDef.blurb}
          aria-label="Target"
          data-fusion-link-target={link.id}
        >
          {FUSION_TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {/* SIGNED amount. The negative half is not decoration: the polarity IS
            half of what a relationship says, and inverting one link is how a
            user turns "denser glyphs mean more ink" into "…mean less". */}
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={link.amount}
          onChange={(e) => onPatch({ amount: Number(e.target.value) })}
          className="fs-slider w-28"
          aria-label="Amount"
          data-fusion-link-amount={link.id}
        />
        <span className="w-10 select-none text-right text-[11px] tabular-nums text-foreground">
          {link.amount > 0 ? "+" : ""}
          {link.amount.toFixed(2)}
        </span>
        {/* WHAT IT IS DOING RIGHT NOW. A bar that moves while you watch is the
            only honest answer to "is this doing anything", and it is the half
            this panel never had — it could explain silence and could not
            demonstrate life. Driven straight into the DOM by `useLinkMeter`, so
            it costs no React render. */}
        <span
          className="flex select-none items-center gap-1"
          title="How hard this relationship is pushing right now. It moves while the fusion runs."
          data-fusion-link-meter={link.id}
        >
          {/* Labelled, because two numbers side by side with no words between
              them is two numbers. "+0.70" is what the user SET; this is what it
              is DOING. Same treatment as "drives", so the row reads as a
              sentence with a live reading on the end of it. */}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">now</span>
          <span className="relative block h-1 w-10 overflow-hidden rounded-full bg-muted">
            <span
              ref={meter.bar}
              className="absolute inset-y-0 left-0 block rounded-full bg-foreground/70"
              style={{ width: "0%" }}
            />
          </span>
          <span
            ref={meter.num}
            className="w-8 text-right text-[10px] tabular-nums text-muted-foreground"
          >
            —
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? "Remove this relationship" : "A fusion needs at least one relationship"}
          className="fs-press ml-auto select-none rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          data-fusion-link-remove={link.id}
        >
          Remove
        </button>
      </div>
      {asleep.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="text-amber-600 dark:text-amber-400">Asleep:</span>
          <span>{asleep.map((a) => a.why).join("; ")}.</span>
          {fixes.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => applyFix(f)}
              data-fusion-fix={f}
              className="fs-press select-none rounded-full border border-border px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-muted"
            >
              {fixLabel(f)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomFusionEditor({
  fusion,
  styleState,
  setStyleState,
  cameraSpin,
  onSpin,
}: {
  fusion: CustomFusion
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  cameraSpin: number
  onSpin: (deg: number) => void
}) {
  // ONE WRITER for the library, so no code path can update a fusion by identity
  // instead of by id and leave two copies diverging.
  const update = (patch: (f: CustomFusion) => CustomFusion) =>
    setStyleState((s) => ({
      ...s,
      customFusions: s.customFusions.map((f) => (f.id === fusion.id ? patch(f) : f)),
    }))
  // What this fusion needs that the composition is not giving it, derived from
  // its own links. Empty when everything is awake, and the banner disappears.
  const wake = fusionWakePatch(
    fusion,
    { ...styleState, cameraSpinDegPerSecond: cameraSpin },
    resolveFusionDrive(styleState),
  )

  /* SHOW THE USER THE THING THEY JUST MADE.
   *
   * MEASURED, not assumed. The panel body is a shared `max-h-[22rem]` scroller
   * (scrollHeight 556 against clientHeight 350), and with the rail now carrying
   * twelve relationships plus the authoring buttons the editor opens with its
   * TOP 9px above the fold — 194 of its 203px below it. So clicking "+ New
   * fusion" produced a nine-pixel sliver of the surface the whole feature is
   * about, on a panel that gives no sign it scrolls.
   *
   * Scrolling rather than REORDERING, deliberately: the editor is last for a
   * reason that still holds (see the comment at its call site — putting the
   * tallest block above the dials pushes Link/Swing/Speed off the bottom for
   * exactly the people who need them). Both blocks can be reachable; only one
   * can be first, and an explicit create is the moment to move.
   *
   * Keyed on `fusion.id`, so it fires on create and on switching between two
   * fusions and NOT on every keystroke in the name field. `behavior: smooth` is
   * skipped under reduced motion — the scroll still happens, it just does not
   * travel, which is the rule the rest of this app follows. */
  const editorRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" })
  }, [fusion.id])

  return (
    <div
      ref={editorRef}
      className="flex flex-col gap-2 rounded-lg border border-foreground/20 bg-muted/20 p-2.5"
      data-fusion-editor
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className={fieldLabelClass}>Name</span>
          <input
            type="text"
            value={fusion.name}
            onChange={(e) => update((f) => ({ ...f, name: e.target.value }))}
            maxLength={28}
            className="w-40 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground"
            data-fusion-name
          />
        </label>
        <label className="flex items-center gap-1.5" title="The colour a `glow` link lights the body with.">
          <span className={fieldLabelClass}>Glow</span>
          <input
            type="color"
            value={fusion.glowColor}
            onChange={(e) => update((f) => ({ ...f, glowColor: e.target.value }))}
            className="h-6 w-8 cursor-pointer rounded border border-border bg-background"
            data-fusion-glow
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setStyleState((s) => {
              const copy = {
                ...newCustomFusion(`${fusion.name} copy`),
                links: fusion.links.map((l, i) => ({ ...l, id: `l${i}${Math.random().toString(36).slice(2, 6)}` })),
                glowColor: fusion.glowColor,
              }
              return {
                ...s,
                customFusions: [...s.customFusions, copy],
                fusionPreset: customFusionKey(copy.id),
              }
            })
          }
          className="fs-press select-none rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          data-fusion-duplicate
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() =>
            setStyleState((s) => ({
              ...s,
              customFusions: s.customFusions.filter((f) => f.id !== fusion.id),
              // Deleting the SELECTED fusion has to move the selection, or the
              // rail shows nothing active while a dangling id sits in state.
              fusionPreset: "none",
              fusionDrive: "loop",
              fusionAnimationEnabled: false,
            }))
          }
          className="fs-press ml-auto select-none rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          data-fusion-delete
        >
          Delete
        </button>
      </div>

      {/* The concept, read back. This is the line that makes an authored fusion
          a THING rather than a settings blob. */}
      <p className="text-[11px] leading-relaxed text-muted-foreground" data-fusion-description>
        <span className="font-medium text-foreground">{fusion.name || "Untitled"}.</span>{" "}
        {describeFusion(fusion)}
      </p>

      {/* WAKE THE WHOLE THING, NOT ONE ROW AT A TIME.
          The per-row fix already existed and it is still the precise tool; what
          was missing is the answer to "just make it work". With four or nine
          relationships — Whole Cloth has nine — curing them one row at a time is
          nine clicks and nine chances to give up, which is the same silence in a
          longer coat. `fusionWakePatch` derives the whole composition from the
          links, so this button and the row buttons cannot disagree. */}
      {wake.turnsOn.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5">
          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Some of this is not running yet. It needs{" "}
            {wake.turnsOn.length > 1
              ? `${wake.turnsOn.slice(0, -1).join(", ")} and ${wake.turnsOn[wake.turnsOn.length - 1]}`
              : wake.turnsOn[0]}
            .
          </span>
          <button
            type="button"
            onClick={() => {
              setStyleState((s) => ({ ...s, ...wake.patch }))
              /* The turntable is not style state, so it cannot ride in `patch`.
                 A button that lists "the turntable" among the things it will
                 switch on and then does not switch it on is the defect this
                 file has already shipped once (the warning named ASCII and the
                 button fixed Texture). */
              if (wake.spin) onSpin(wake.spin)
            }}
            className="fs-press ml-auto select-none rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            data-fusion-wake
          >
            Switch it on
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {fusion.links.map((link) => (
          <FusionLinkRow
            key={link.id}
            link={link}
            fusionId={fusion.id}
            styleState={styleState}
            setStyleState={setStyleState}
            cameraSpin={cameraSpin}
            onSpin={onSpin}
            canRemove={fusion.links.length > 1}
            onPatch={(patch) =>
              update((f) => ({
                ...f,
                links: f.links.map((l) => (l.id === link.id ? { ...l, ...patch } : l)),
              }))
            }
            onRemove={() =>
              update((f) => ({ ...f, links: f.links.filter((l) => l.id !== link.id) }))
            }
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => update((f) => ({ ...f, links: [...f.links, newFusionLink()] }))}
        className="fs-press self-start select-none rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        data-fusion-add-link
      >
        + Add relationship
      </button>
    </div>
  )
}

/* ======================================================================== */
/*  THE COMBINATION PICKER — one fusion for every combination of the seven   */
/*  ---------------------------------------------------------------------- */
/*  Sebs: *"there should be a fusion for every possible combo… there's like  */
/*  7 styles… so it would be like 2 to the power of 7"*. That is 120 cells,  */
/*  and 120 PILLS WOULD BE A WALL, not an answer — this panel already lost   */
/*  its dials below the fold once when nine pills wrapped to two lines       */
/*  (assert-fusion-ui caught it; the intro paragraph was cut to buy the      */
/*  height back). A rail of 120 would bury every control in the panel.       */
/*                                                                          */
/*  So the combination is the CONTROL: seven chips, one per panel, and the   */
/*  cell for whatever you have selected is named underneath. You do not      */
/*  hunt for "the texture + dither + material one" in a list — you press     */
/*  Texture, Dither and Material and it is there. The full grid is still one */
/*  click away for browsing, grouped by how many systems each cell fuses,    */
/*  because a set you cannot see whole is a set you cannot judge.            */
/*                                                                          */
/*  THE FOUR EMPTY CELLS ARE REACHABLE AND SAY WHY. `animation+layers`,      */
/*  `animation+fusion`, `layers+fusion` and all three together contain no    */
/*  system that owns a fusion TARGET — they are clocks, and clocks have      */
/*  nothing to write to. A disabled pill would teach the user nothing; the   */
/*  cell renders its reason and the one press that fixes it.                 */
/* ======================================================================== */

function FusionCombinationPicker({
  styleState,
  cameraSpin,
  onSelectCombo,
}: {
  styleState: StyleState
  cameraSpin: number
  onSelectCombo: (c: FusionCombo) => void
}) {
  const activeKey = styleState.fusionPreset.startsWith("combo:")
    ? styleState.fusionPreset.slice("combo:".length)
    : null
  /* THE CHIPS START FROM WHAT IS SELECTED, so pressing one more chip walks you
     from the cell you are on to its neighbour instead of starting over. */
  const [picked, setPicked] = useState<FusionSystemId[]>(
    () => (activeKey ? (activeKey.split("+") as FusionSystemId[]) : ["texture", "dither"]),
  )
  const [browsing, setBrowsing] = useState(false)
  const key = comboKeyOf(picked)
  const cell = FUSION_COMBOS_BY_KEY[key]
  const toggle = (id: FusionSystemId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const sizes = [2, 3, 4, 5, 6, 7]
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-muted/20 px-2.5 py-2.5" data-fusion-combos>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={fieldLabelClass}>Combination</span>
        <span className="text-[10px] leading-relaxed text-muted-foreground">
          Pick the systems you want fused. Every one of the {FUSION_COMBO_LIST.length} combinations of two or
          more has its own relationship.
        </span>
      </div>

      {/* The seven, in panel order. */}
      <div className="flex flex-wrap gap-1.5">
        {FUSION_SYSTEMS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={pillClass(picked.includes(s.id))}
            title={s.blurb}
            data-fusion-system={s.id}
            aria-pressed={picked.includes(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* What that combination IS. */}
      {picked.length < 2 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pick at least two. Fusion is systems influencing each other, so one on its own has nothing to
          be related to.
        </p>
      ) : cell ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectCombo(cell)}
              /* No `!px-3` here. Tailwind v4 moved the important modifier to a
                 SUFFIX (`px-3!`), so the prefix form emits no CSS at all — a
                 class that does nothing, wearing the name of one that would.
                 The pill does not need to be wider; it needs to be right. */
              className={pillClass(activeKey === cell.key)}
              data-fusion-combo={cell.key}
              title={cell.concept}
            >
              {cell.name}
            </button>
            <span className="text-[10px] text-muted-foreground">
              {picked.length} systems · {cell.empty ? "no relationship possible" : `${cell.links.length} relationships`}
              {cell.drive !== "loop" ? ` · ${cell.drive}` : ""}
            </span>
            {SHIPPED_BY_COMBO_KEY[cell.key]?.length ? (
              <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                also on the rail: {SHIPPED_BY_COMBO_KEY[cell.key].join(", ")}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{cell.concept}</p>
          {!cell.empty && (
            <p className="text-[10px] leading-relaxed text-muted-foreground/80">{describeFusion(cell)}</p>
          )}
          {/* A View cell rests at EXACTLY zero head-on. Selecting it turns the
              turntable on; if it is already off again, say so rather than
              letting the relationship look broken. */}
          {!cell.empty && cell.links.some((l) => l.source === "orbit") && cameraSpin === 0 && (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              This one answers the camera. Selecting it starts the turntable, because head-on the view
              source rests at exactly zero.
            </p>
          )}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setBrowsing((b) => !b)}
          className="fs-press select-none rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          data-fusion-browse
        >
          {browsing ? "Hide" : `Browse all ${FUSION_COMBO_LIST.length}`}
        </button>
      </div>

      {browsing && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          {sizes.map((n) => {
            const cells = FUSION_COMBO_LIST.filter((c) => c.systems.length === n)
            return (
              <div key={n}>
                <div className={fieldLabelClass}>
                  {n} systems <span className="text-foreground">{cells.length}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cells.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setPicked(c.systems)
                        onSelectCombo(c)
                      }}
                      className={`${pillClass(activeKey === c.key)} ${c.empty ? "opacity-60" : ""}`}
                      title={`${c.key}\n\n${c.concept}`}
                      data-fusion-combo={c.key}
                    >
                      {c.name}
                      {c.empty ? " ·" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            The four marked · are combinations of clocks only. Animation, Layers and Fusion all
            generate signal and none of them owns a parameter, so there is nothing for a relationship
            to write to. They are here, and they say so, rather than being quietly missing.
          </p>
        </div>
      )}
    </div>
  )
}

function FusionControl({
  styleState,
  setStyleState,
  onSelectPreset,
  cameraSpin,
  onSpin,
  onSelectCombo,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
  cameraSpin: number
  onSpin: (deg: number) => void
  onSelectCombo: (c: FusionCombo) => void
}) {
  const on = styleState.fusionPreset !== "none"
  const drive = resolveFusionDrive(styleState)
  // The caption reflects what is actually running: the named (preset x drive)
  // combination, looked up in the registry so the text can never disagree with
  // the behaviour.
  const activeDef = findFusionShapeDef(styleState.fusionPreset, drive)
  // The user's own fusions, and which (if any) is selected.
  const mine = styleState.customFusions
  const editingId = customFusionIdOf(styleState.fusionPreset)
  const editing = editingId ? mine.find((f) => f.id === editingId) : undefined
  /* SELECTING ONE OF YOURS PUTS ITS SYSTEMS ON, exactly as selecting one of
   * ours does. Every built-in relationship ships an `applies` patch that turns
   * its layers on (lib/style-system.ts, `FUSION_PRESET_DEFS`); a user's fusion
   * had none, so it was the only member of the rail that landed on whatever
   * composition happened to be there — which is most of "nothing applies". */
  const selectCustom = (id: string) =>
    setStyleState((s) => {
      const f = s.customFusions.find((c) => c.id === id)
      const wake = f ? fusionWakePatch(f, s, resolveFusionDrive(s)).patch : {}
      return { ...s, ...wake, fusionPreset: customFusionKey(id) }
    })
  /**
   * A NEW FUSION MUST ACT THE INSTANT IT EXISTS — and "turn the layers on" was
   * not enough, which is the whole finding of 2026-08-03.
   *
   * This used to set `ditherEnabled` and `asciiEnabled` and stop. Both seed
   * links then still did essentially nothing: the first reads the GLYPH FIELD'S
   * PHASE, which is pinned while ASCII is enabled-but-not-animating, so it
   * contributed EXACTLY 0.000000 (measured model-side against the state this
   * very function produced); and the layers arrived at their bare defaults,
   * which on the near-black `ink` body crushes the mark to a black bar keeping
   * 87.0% of its inked area, instead of reading as a screen ON the stroke
   * (docs/verification/fusion-newborn/wake-v3/SHEET-wake.png).
   *
   * `fusionWakePatch` fixes both from one place: it derives the composition from
   * the fusion's own links — layer, animation, travel direction, material — with
   * numbers inherited from the built-in that already proved them on this body.
   */
  const createFusion = (make: () => CustomFusion) =>
    setStyleState((s) => {
      const f = make()
      const wake = fusionWakePatch(f, s, resolveFusionDrive(s)).patch
      return {
        ...s,
        ...wake,
        customFusions: [...s.customFusions, f],
        fusionPreset: customFusionKey(f.id),
      }
    })
  /* "Edit a copy" — the answer to *"i dont think it makes sense or is clear how
   * to set one up"* that no amount of help text is. The four newest built-ins
   * ARE link lists (`BUILTIN_LINK_FUSIONS`), so this hands the user a working,
   * shipped relationship open in the editor with every sentence visible. It is
   * offered only where the copy would be exact: the eight original relationships
   * are hand-written branches, and seeding an approximation of one under the
   * label "a copy" would be inventing provenance. */
  /* "Edit a copy" reaches the combination cells too — they ARE link lists, so
     the copy is exact, which is the only condition this offer was ever made
     under (the eight hand-written branches are still excluded). An EMPTY cell
     has no links to copy and is excluded by the same rule. */
  const activeCombo = FUSION_COMBOS_BY_KEY[styleState.fusionPreset.replace(/^combo:/, "")] ?? null
  const editableBuiltin =
    BUILTIN_LINK_FUSIONS[styleState.fusionPreset] ??
    (activeCombo && !activeCombo.empty ? activeCombo : undefined)
  const driveDef = FUSION_DRIVES.find((d) => d.id === drive)!
  // ONE WRITER for the drive, so `fusionDrive` and its legacy mirror
  // `fusionAnimationEnabled` cannot drift apart.
  const setDrive = (d: FusionDrive) =>
    setStyleState((s) => ({ ...s, fusionDrive: d, fusionAnimationEnabled: d !== "loop" }))
  return (
    /* gap-3 and no restatement of the panel header.
       This panel carries the most controls of any in the drawer (nine pills, three
       drive pills, three dials, a caption) inside a shared max-height with
       overflow-y-auto, and the click-through's box check found all three dials
       clipped below the fold — the dials that answer "why is nothing moving" were
       the ones you had to scroll for. The intro paragraph that used to sit here
       restated the panel's own header note at four times the length, so it was the
       first thing to go. */
    <div className="flex flex-col gap-3">
      <Field k={[]} /* controller 2026-09-26: Customize edits the picked preset; a picker here would swap the whole preset, so these stay out of Customize */>
      <div>
        <span className={fieldLabelClass}>Relationship</span>
        {/* No max-width: nine pills fit on ONE line in the drawer's real width,
            and the two-line wrap was costing 28px of the height budget that the
            dials needed. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() =>
              setStyleState((s) => ({
                ...s,
                fusionPreset: "none",
                fusionDrive: "loop",
                fusionAnimationEnabled: false,
              }))
            }
            className={pillClass(!on)}
            title="No fusion. Layers keep their own settings."
          >
            None
          </button>
          {PRESET_REGISTRY.fusion.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset("fusion", p.id)}
              className={pillClass(styleState.fusionPreset === p.id)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
          {/* ---- YOURS, ON THE SAME RAIL. ------------------------------------
              The eight above are relationships we authored; these are the ones
              the USER authors (PRD Layer 14 — "a NEW AUTHORED visual system").
              They sit on the same row on purpose, and not only for space: a
              fusion you made is not a lesser kind of fusion, and a separate
              labelled section said otherwise.
              THE SPACE MATTERS TOO. The first version put them in their own
              block with a heading and a paragraph of help, and assert-fusion-ui
              immediately caught what that cost: the three dials — the ones that
              answer "why is nothing moving" — went back below the panel's fold.
              The help moved into the button's title, where it is still one
              hover away and costs no height. */}
          <span aria-hidden className="mx-0.5 my-auto h-4 w-px shrink-0 bg-border" />
          {mine.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => selectCustom(f.id)}
              className={pillClass(styleState.fusionPreset === customFusionKey(f.id))}
              title={describeFusion(f)}
              data-fusion-pill={f.id}
            >
              {f.name || "Untitled"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => createFusion(() => newCustomFusion(`My fusion ${mine.length + 1}`))}
            title="Build your own: pick what drives what, and how hard. A fusion is not a saved slider state. It is a set of relationships, and a new one starts with the real thing: the ASCII field driving the dither threshold."
            className="fs-press select-none rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            data-fusion-new
          >
            + New fusion
          </button>
          {/* FUSE EVERYTHING, IN ONE MOVE — the thing Sebs assumed fusion
              already was. It makes a fusion that links every system at once,
              each on a DIFFERENT driver (see `fuseEverything`), and drops it
              open in the editor so the nine sentences are readable and every one
              of them is editable. Not a preset: it lands in YOUR library, which
              is the difference between a look and a starting point. */}
          <button
            type="button"
            onClick={() => createFusion(() => fuseEverything(`Everything ${mine.length + 1}`))}
            title="One fusion that links every system at once. The pattern, the screen, the characters, the stack, the surface and the draw, each on its own driver so they move together without moving as one. Lands in your library, open and editable."
            className="fs-press select-none rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            data-fusion-everything
          >
            + Fuse everything
          </button>
        </div>
      </div>
      </Field>

      {/* A COMBINATION CELL HAS NO ENTRY IN `FUSION_PRESET_DEFS`, so
          `findFusionShapeDef` cannot caption it — and a panel that goes silent
          for 120 of its own options would be the exact "a working control that
          cannot say so" defect the live meter was added to fix. The cell carries
          its own concept; this renders it in the same slot, same shape. */}
      <Field k={[]}>
      {!editing && activeCombo && (
        <div className="flex max-w-2xl flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2">
          <p data-fusion-caption className="flex-1 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{activeCombo.name}.</span> {activeCombo.concept}
          </p>
        </div>
      )}
      </Field>

      <Field k={[]} /* controller 2026-09-26: Customize edits the picked preset; a picker here would swap the whole preset, so these stay out of Customize */>
      {!editing && !activeCombo && activeDef?.description && (
        <div className="flex max-w-2xl flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2">
          {/* `data-fusion-caption`, because the caption is now a child of the
              block rather than the block itself — it gained an "Edit a copy"
              button beside it. assert-fusion-ui located it as `p.rounded-md`,
              which is a STYLING class, and moving the rounding to the container
              silently broke the locator: the gate did not report a wrong caption,
              it timed out reading a caption that no longer matched. A control's
              identity should not live in its border radius. */}
          <p
            data-fusion-caption
            className="flex-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            <span className="font-medium text-foreground">{activeDef.label}.</span>{" "}
            {activeDef.description}
          </p>
          {editableBuiltin && (
            <button
              type="button"
              onClick={() =>
                createFusion(() => ({
                  ...newCustomFusion(`${editableBuiltin.name} copy`),
                  glowColor: editableBuiltin.glowColor,
                  links: editableBuiltin.links.map((l, i) => ({
                    ...l,
                    id: `l${i}${Math.random().toString(36).slice(2, 6)}`,
                  })),
                }))
              }
              title="Open this relationship in the editor as a fusion of your own: the same sentences, yours to change."
              className="fs-press select-none rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              data-fusion-fork-builtin
            >
              Edit a copy
            </button>
          )}
        </div>
      )}
      </Field>

      <Field k={["fusionDrive", "fusionAnimationEnabled", "fusionIntensity", "fusionSwing", "fusionAnimationSpeed"]} group>
      <div
        className={`flex flex-col gap-3 border-t border-border pt-2.5 ${
          on ? "" : "pointer-events-none opacity-50"
        }`}
      >
        <Field k={["fusionDrive", "fusionAnimationEnabled"]}>
        <div>
          <span className={fieldLabelClass}>
            Drive. How the relationship moves through time. Every relationship supports all three.
          </span>
          <div className="mt-1.5 flex max-w-2xl flex-wrap gap-1.5">
            {FUSION_DRIVES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDrive(d.id)}
                aria-pressed={drive === d.id}
                className={pillClass(drive === d.id)}
                title={d.blurb}
                disabled={!on}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{driveDef.blurb}</p>
        </div>
        </Field>

        {/* THREE DIALS SIDE BY SIDE, not stacked.
            Stacked full-width they pushed all three past the panel body's
            max-height and a user scrolling to find "why is nothing still" would
            not see the dial that answers it — verified in the click-through
            screenshot, where the panel ended at the Drive row. */}
        <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field k={"fusionIntensity"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Link <span className="text-foreground">{styleState.fusionIntensity.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={styleState.fusionIntensity}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, fusionIntensity: Number(e.target.value) }))
              }
              className="fs-slider w-full"
              disabled={!on}
            />
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              How hard the driver reaches the driven parameter. 0 unlinks them; the look stays.
            </span>
          </label>
          </Field>

          <Field k={"fusionSwing"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Swing <span className="text-foreground">{styleState.fusionSwing.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={styleState.fusionSwing}
              onChange={(e) => setStyleState((s) => ({ ...s, fusionSwing: Number(e.target.value) }))}
              className="fs-slider w-full"
              disabled={!on}
            />
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              How far the drive&rsquo;s own signal travels. 0 holds it at rest. Still linked, and
              still moved by the draw.
            </span>
          </label>
          </Field>

          <Field k={"fusionAnimationSpeed"}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed{" "}
              <span className="text-foreground">{styleState.fusionAnimationSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.fusionAnimationSpeed}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, fusionAnimationSpeed: Number(e.target.value) }))
              }
              className="fs-slider w-full"
              disabled={!on}
            />
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              The rhythm of the drive: the loop&rsquo;s breath, the arrival&rsquo;s length, the
              event cadence.
            </span>
          </label>
          </Field>
        </div>
      </div>
      </Field>

      {/* THE POWER SET, BELOW THE DIALS — AND IT WAS ABOVE THEM, WHICH BROKE THE
          ONE THING THIS PANEL HAS ALREADY BEEN BURNED BY.

          It shipped directly under the rail, on the reasoning that it IS the
          rail continued: the fourteen pills are the relationships authored by
          hand, and this is the same question asked exhaustively. That reasoning
          is fine and it cost the dials their visibility. The picker is seven
          chips, a name, a concept, a sentence per link and a browse button —
          five or six rows that are always on screen — and with it above them,
          `assert-fusion-ui.mjs` measured **Link, Swing and Speed all clipped
          out of the panel body**, along with every one of their explanations.

          That is the identical defect the comment below this one records for
          the editor, and the identical defect §6 of explainer 25 cites as the
          reason this gate exists: *"this panel has already lost its dials below
          the fold once, when nine pills wrapped to two lines — caught by
          assert-fusion-ui.mjs, not by eye."* Twice caught by the same
          instrument, twice invisible to whoever added the block.

          **The rule the file already states is the fix: shallow controls first,
          deep surface last.** Drive and the three dials govern ANY fusion,
          built-in, authored or combination — including every cell this picker
          selects — so a user who presses a cell and asks "why is nothing
          moving" must be able to see Link without scrolling. */}
      <Field k={[]} /* controller 2026-09-26: Customize edits the picked preset; a picker here would swap the whole preset, so these stay out of Customize */>
      <FusionCombinationPicker
        styleState={styleState}
        cameraSpin={cameraSpin}
        onSelectCombo={onSelectCombo}
      />
      </Field>

      {/* THE EDITOR IS LAST, DELIBERATELY.
          It is by far the tallest block in the drawer — a row per relationship,
          each with two dropdowns, a slider and possibly a warning — so putting
          it above the dials pushed Link, Swing and Speed off the bottom of the
          panel for exactly the users most likely to need them. Drive and the
          three dials govern ANY fusion, built-in or authored; the editor is the
          one deep surface. Shallow controls first, deep surface last, and the
          scroll lands where scrolling is expected. */}
      <Field k={"customFusions"}>
      {editing && (
        <CustomFusionEditor
          fusion={editing}
          styleState={styleState}
          setStyleState={setStyleState}
          cameraSpin={cameraSpin}
          onSpin={onSpin}
        />
      )}
      </Field>
    </div>
  )
}

/* ---- Animation panel: full IA, only Material is functional ---- */
function AnimationControl({
  styleState,
  setStyleState,
  drawInTiming,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  drawInTiming?: DrawInTimingProps
}) {
  const inCustomize = useContext(FieldScopeCtx) !== null
  return (
    <div className="flex flex-col gap-4">
      {/* THE DRAW-IN, FIRST. Until 2026-09-25 this tab only pointed at the
          Timing button, which exists once a stroke is drawn, and he looked here
          and found nothing (ledger 1.2, nine times). Same component as the
          popover, so the two cannot drift. Shown with nothing drawn, enabled,
          with one line saying when it acts. `columns-2xs` lets the drawer's
          width decide the column count (two at 1280, three at 1512) instead of
          leaving 80% of it empty, F110. */}
      {/* In Customize, a draw-in preset's fields flow straight into its two
          columns with the same controls, each block behind its own <Field>
          (MOTION-CUSTOM). The group hides it all under a preset that sets no
          motion field, which is every family but Geometry Animation. */}
      {/* THE DOOR TO THE DOCK (plan 2026-09-26 §1). The strip, the key lanes and
          Perform read state only the viewport has, so they live in the
          Animation panel under the canvas and are not mirrored here. This row
          says where they are and opens that panel with Draw-in expanded. */}
      {drawInTiming && !inCustomize && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Strokes, keys and Perform are in the Animation panel under the canvas.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ANIMATION_PANEL_EVENT))}
            className="fs-press shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Show animation panel
          </button>
        </div>
      )}
      {inCustomize && drawInTiming && (
        <Field group k={MOTION_FIELD_KEYS}>
          <DrawInTimingControls {...drawInTiming} wrap={fieldWrap} showPace />
        </Field>
      )}
      <Field k={[]}>
      {drawInTiming && !inCustomize && (
        <section aria-labelledby="animation-drawin-heading" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h4 id="animation-drawin-heading" className="text-xs font-semibold text-foreground">
              How the draw-in plays
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {drawInTiming.strokeCount === 0
                ? "Nothing drawn yet. Set these now and your first stroke plays with them."
                : "The same controls as Draw-in in the Animation panel."}
            </p>
          </div>
          <div className="columns-2xs gap-3 [&>*]:break-inside-avoid">
            <DrawInTimingControls {...drawInTiming} wrap={fieldWrap} showPace />
          </div>
        </section>
      )}
      </Field>

      {/* Global motion timing — affects which clock animated style systems use. */}
      <Field k={"motionMode"}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Motion mode (timing source)</span>
        <select
          value={styleState.motionMode}
          onChange={(e) =>
            setStyleState((s) => ({ ...s, motionMode: e.target.value as StyleState["motionMode"] }))
          }
          className={selectClass}
        >
          <option value="off">Off (static)</option>
          <option value="independent">Independent clock</option>
          <option value="syncToDraw">Sync to Draw</option>
        </select>
      </label>
      <p className="-mt-1 text-[10px] leading-relaxed text-muted-foreground">
        &ldquo;Sync to Draw&rdquo; lets visual (style) animation use draw/reveal progress as its timing input. It
        does <span className="font-medium text-foreground">not</span> change geometry animation behavior.
      </p>
      </Field>

      {/* Shared loop length — every layer on "Loop synced" uses this, which is
          what lets several layers repeat in lockstep. */}
      <Field k={"styleLoopSeconds"}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>
          Shared loop length <span className="text-foreground">{styleState.styleLoopSeconds.toFixed(1)}s</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={12}
          step={0.5}
          value={styleState.styleLoopSeconds}
          onChange={(e) => setStyleState((s) => ({ ...s, styleLoopSeconds: Number(e.target.value) }))}
          className={sliderClass}
        />
        <span className="text-[10px] leading-relaxed text-muted-foreground">
          Layers set to &ldquo;Loop synced&rdquo; share this cycle, so they repeat together.
          Each layer&apos;s own timing mode and delay live in its panel.
        </span>
      </label>
      </Field>

      {/* The animation categories. A readout, no field, so Customize never shows it. */}
      <Field k={[]}>
      <div className="flex flex-col gap-1.5">
        {ANIMATION_CATEGORIES.map((c) => {
          const badge =
            c.state === "active"
              ? { text: "live", cls: "bg-foreground/10 text-foreground" }
              : c.state === "basic"
                ? { text: "playback", cls: "bg-foreground/10 text-foreground" }
                : { text: "coming soon", cls: "bg-muted text-muted-foreground" }
          return (
            <div
              key={c.key}
              className={`rounded-md border border-border p-2.5 ${
                c.state === "active" ? "bg-muted/30" : "bg-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{c.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.text}</span>
                {c.key === "material" && styleState.materialAnimationEnabled && (
                  <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    on: {styleState.materialAnimationType}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{c.detail}</p>
            </div>
          )
        })}
      </div>
      </Field>
    </div>
  )
}

/** Renders the real, working control(s) for a given panel. */
/* FIELD SCOPE. Customize shows a preset's fields with the panel's own
   controls, never a copy. A control block wrapped in <Field k="…"> renders as
   it always has when no scope is set; inside Customize it renders only when
   the preset sets one of its keys, with the edited dot and a one-click reset.
   `group` wraps a section that holds several fields: it shows or hides with
   them and carries no dot of its own. A control nobody has wrapped yet is
   found by Customize from the DOM (no `data-field-keys` for it) and shown
   read-only, so a missing wrapper is visible, not silently dropped. */
type FieldScope = {
  keys: ReadonlySet<string>
  edited: ReadonlySet<string>
  onReset: (keys: PresetFieldKey[]) => void
}
const FieldScopeCtx = createContext<FieldScope | null>(null)

/** Every flat key a draw-in preset can set, for the group that holds them. */
const MOTION_FIELD_KEYS: PresetFieldKey[] = [
  "drawIn.order", "drawIn.overlap", "drawIn.align", "drawIn.unit", "drawIn.reverse",
  "revealWindow.mode", "revealWindow.length",
  "envelope.mode", "envelope.ease", "envelope.delaySeconds", "envelope.cadence", "envelope.loop", "envelope.reverse",
  "envelope.tipHighlight", "envelope.pressureReveal",
]
/** DrawInTimingControls lives in its own file, so it takes <Field> as a prop. */
const fieldWrap = (keys: string[], node: React.ReactNode) => <Field k={keys as PresetFieldKey[]}>{node}</Field>

function Field({
  k,
  group,
  children,
}: {
  k: PresetFieldKey | PresetFieldKey[]
  group?: boolean
  children: React.ReactNode
}) {
  const scope = useContext(FieldScopeCtx)
  if (!scope) return <>{children}</>
  const keys = (Array.isArray(k) ? k : [k]).filter((x) => scope.keys.has(x))
  if (!keys.length) return null
  if (group) return <>{children}</>
  const edited = keys.filter((x) => scope.edited.has(x))
  return (
    <ScopedField keys={keys} edited={edited} onReset={scope.onReset}>
      {children}
    </ScopedField>
  )
}

/* F124. An edited field's dot and Reset sit 8 px after the end of its label's
   text, centred on that line, so they read as part of that field. They used to
   sit at the wrapper's top right, which in a two-column Customize is the right
   edge of the column: 505 to 514 px from the label at 1512 wide, in the gutter.
   The label is the first span in the field with text of its own, outside any
   button, select or option. The mark stays a sibling of the <label>, placed
   by measuring the label's last text line: inside the <label> it would become
   the control the <label> names, so the slider would lose its name and a click
   on the label text would press Reset. It is measured again on every render
   (the value in the label changes width as the slider moves) and when the
   field resizes (the label can rewrap). A last line too long to leave room
   puts the mark at the field's right edge on that line. A field with no such
   label keeps the top-right corner. */
function ScopedField({
  keys,
  edited,
  onReset,
  children,
}: {
  keys: PresetFieldKey[]
  edited: PresetFieldKey[]
  onReset: (keys: PresetFieldKey[]) => void
  children: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLSpanElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const marked = edited.length > 0
  const place = () => {
    const next = boxRef.current && markRef.current ? markSpot(boxRef.current, markRef.current) : null
    setSpot((prev) => (prev === next || (prev && next && prev.left === next.left && prev.top === next.top) ? prev : next))
  }
  useLayoutEffect(() => {
    if (marked) place()
  })
  useEffect(() => {
    const box = boxRef.current
    if (!marked || !box) return
    const ro = new ResizeObserver(() => place())
    ro.observe(box)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marked])
  return (
    <div ref={boxRef} className="relative" data-field-keys={keys.join(" ")} data-field-edited={marked ? "" : undefined}>
      {marked && (
        <EditedMark
          ref={markRef}
          onReset={() => onReset(edited)}
          className="absolute flex"
          style={spot ?? { right: 0, top: 0 }}
        />
      )}
      {children}
    </div>
  )
}

const MARK_GAP = 8

function fieldLabelOf(box: HTMLElement): HTMLElement | null {
  for (const s of box.querySelectorAll<HTMLElement>("span")) {
    if (s.closest("button, select, option, [data-edited-mark]")) continue
    for (const n of s.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return s
  }
  return null
}

/** Where the mark goes in its field's box: after the label's last text line. */
function markSpot(box: HTMLElement, mark: HTMLElement): { left: number; top: number } | null {
  const label = fieldLabelOf(box)
  if (!label) return null
  const range = document.createRange()
  range.selectNodeContents(label)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0)
  if (!rects.length) return null
  const lastTop = Math.max(...rects.map((r) => r.top))
  const line = rects.filter((r) => r.top > lastTop - 4)
  const b = box.getBoundingClientRect()
  const right = Math.max(...line.map((r) => r.right)) - b.left
  const mid = (Math.min(...line.map((r) => r.top)) + Math.max(...line.map((r) => r.bottom))) / 2 - b.top
  return {
    left: Math.round(Math.min(right + MARK_GAP, b.width - mark.offsetWidth)),
    top: Math.round(mid - mark.offsetHeight / 2),
  }
}

/* font-normal and the size are the mark's own, not its surroundings'. */
function EditedMark({
  onReset,
  className,
  style,
  ref,
}: {
  onReset: () => void
  className: string
  style?: React.CSSProperties
  ref?: React.Ref<HTMLSpanElement>
}) {
  return (
    <span ref={ref} data-edited-mark style={style} className={`items-center gap-1.5 font-normal ${className}`}>
      <span aria-hidden data-edited-dot className="size-1.5 rounded-full bg-primary" />
      <button
        type="button"
        data-field-reset
        onClick={onReset}
        title="Back to the preset's value"
        className="text-[10px] leading-none text-muted-foreground hover:text-foreground"
      >
        Reset
      </button>
    </span>
  )
}

type PanelHandlers = {
  onSelectPreset: (family: PresetFamily, id: string) => void
  cameraSpin: number
  onSpin: (deg: number) => void
  onSelectCombo: (c: FusionCombo) => void
}
type CustomizeControl = React.ComponentType<
  {
    styleState: StyleState
    setStyleState: (updater: (s: StyleState) => StyleState) => void
    drawInTiming?: DrawInTimingProps
  } & PanelHandlers
>

/** The panel controls that own a family's fields. Empty when none is scoped yet. */
function customizeControlsFor(family: PresetFamily): CustomizeControl[] {
  if (family === "dither") return [DitherControl]
  if (family === "animatedDither") return [DitherControl, AnimationControl]
  if (family === "material" || family === "animatedMaterial") return [MaterialControl]
  if (family === "texture") return [TextureControl]
  if (family === "animatedTexture") return [TextureControl, AnimationControl]
  if (family === "ascii") return [AsciiControl]
  if (family === "animatedAscii") return [AsciiControl, AnimationControl]
  if (family === "layerStack") return [LayersControl, MaterialControl, TextureControl, DitherControl, AsciiControl]
  if (family === "stackAnimation") return [LayersControl]
  if (family === "fusion" || family === "animatedFusion")
    return [FusionControl, LayersControl, MaterialControl, TextureControl, DitherControl, AsciiControl, AnimationControl]
  if (family === "geometryAnimation") return [AnimationControl]
  return []
}

/** The heading a control carries in Customize: its tab's name, with Animation
 *  called Motion. Kept apart from `customizeControlsFor`, whose body the leak
 *  and coverage probes read as text. */
const CUSTOMIZE_SYSTEM_NAME = new Map<CustomizeControl, string>([
  [FusionControl, "Fusion"],
  [LayersControl, "Layers"],
  [MaterialControl, "Material"],
  [TextureControl, "Texture"],
  [DitherControl, "Dither"],
  [AsciiControl, "ASCII"],
  [AnimationControl, "Motion"],
])

const showValue = (v: unknown) =>
  typeof v === "number" ? String(Math.round(v * 1000) / 1000) : typeof v === "string" ? v : JSON.stringify(v)

function NameInput({
  initial,
  cta,
  onDone,
}: {
  initial: string
  cta: string
  onDone: (name: string | null) => void
}) {
  const [name, setName] = useState(initial)
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onDone(name.trim())
      }}
    >
      <input
        autoFocus
        data-name-input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone(null)}
        aria-label="Preset name"
        className={`${selectClass} h-7 min-w-0 flex-1`}
      />
      <button type="submit" data-name-save disabled={!name.trim()} className={pillClass(true)}>
        {cta}
      </button>
      <button type="button" onClick={() => onDone(null)} className={pillClass(false)}>
        Cancel
      </button>
    </form>
  )
}

function PresetCustomize({
  preset,
  styleState,
  setStyleState,
  handlers,
  drawInTiming,
}: {
  preset: StylePreset
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  handlers: PanelHandlers
  drawInTiming?: DrawInTimingProps
}) {
  const take: TakeState | undefined = drawInTiming && {
    drawIn: drawInTiming.drawIn,
    revealWindow: drawInTiming.revealWindow,
    revealEnvelope: drawInTiming.envelope,
  }
  const fields = presetFields(preset)
  const edited = presetEditedFields(styleState, preset, take)
  const controls = customizeControlsFor(preset.family)
  const boxRef = useRef<HTMLDivElement>(null)
  const [claimed, setClaimed] = useState<string[]>([])
  const [naming, setNaming] = useState<null | "save" | "rename">(null)
  useLayoutEffect(() => {
    const seen = new Set<string>()
    boxRef.current
      ?.querySelectorAll<HTMLElement>("[data-field-keys]")
      .forEach((n) => (n.dataset.fieldKeys ?? "").split(" ").forEach((x) => seen.add(x)))
    const next = fields.filter((x) => seen.has(x))
    setClaimed((prev) => (prev.join() === next.join() ? prev : next))
  })
  /* A style field resets through state, a motion field through the take's own
     patch calls, so each lands on the undo stack the way a hand edit does. */
  const reset = (keys: PresetFieldKey[]) => {
    if (keys.some((x) => !x.includes("."))) setStyleState((s) => keys.reduce((acc, x) => resetPresetField(acc, preset, x), s))
    const t = presetTakeReset(preset, keys)
    if (t.drawIn) drawInTiming?.patchDrawIn(t.drawIn)
    if (t.revealWindow) drawInTiming?.patchWindow(t.revealWindow)
    if (t.envelope) drawInTiming?.patchEnvelope(t.envelope)
  }
  const scope: FieldScope = { keys: new Set(fields), edited: new Set(edited), onReset: reset }
  const readOnly = fields.filter((x) => !claimed.includes(x))
  const mine = isMinePreset(preset)
  if (!fields.length) return null
  return (
    /* ANIM-4F. The whole drawer width, not one 512 px column: on Fusion the
       single column ran 2,769 px while the right 760 px sat empty. Save as mine
       sits beside Reset all in the header, where both show without a scroll. */
    <section data-preset-customize className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Customize</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          {mine && naming === null && (
            <>
              <button type="button" data-rename onClick={() => setNaming("rename")} className={pillClass(false)}>
                Rename
              </button>
              <button
                type="button"
                data-delete
                onClick={() => setStyleState((s) => deleteMinePreset(s, preset.id))}
                className={pillClass(false)}
              >
                Delete
              </button>
            </>
          )}
          {naming === null && (
            <button type="button" data-save-mine onClick={() => setNaming("save")} className={pillClass(false)}>
              Save as mine
            </button>
          )}
          <button
            type="button"
            data-reset-all
            disabled={!edited.length}
            onClick={() => reset(fields)}
            className={`${pillClass(false)} ${edited.length ? "" : "cursor-default opacity-45"}`}
          >
            Reset all
          </button>
        </div>
      </div>
      {naming === "rename" && (
        <div className="max-w-sm">
          <NameInput
            initial={preset.label}
            cta="Rename"
            onDone={(name) => {
              if (name) setStyleState((s) => renameMinePreset(s, preset.id, name))
              setNaming(null)
            }}
          />
        </div>
      )}
      {naming === "save" && (
        <div className="max-w-sm">
          <NameInput
            initial={mine ? preset.label : `${preset.label}, mine`}
            cta="Save"
            onDone={(name) => {
              if (name) setStyleState((s) => saveMinePreset(s, preset, name, Date.now().toString(36), take))
              setNaming(null)
            }}
          />
        </div>
      )}
      <div ref={boxRef}>
        {controls.length > 0 && (
          <FieldScopeCtx.Provider value={scope}>
            {/* One section per system, headed by its tab's name, so the dither
                "Cell size" and the ASCII one can be told apart. A section with
                no field in scope hides, heading and all (`has-[...]`). Fields
                flow down two columns (`columns-md` is two from a 920 px drawer
                up, one below it), 24 px apart since each column is its own run;
                no field splits across them. The first block in a section drops
                its top rule: it divided that block from a picker Customize
                hides, so it divided nothing (the rule under the header). The
                other group rules go too, as a column top can land on one (it
                did on ASCII Animation). Each control's own flex root becomes
                `contents`, so its blocks flow as plain blocks: 16 px between
                fields, 24 above a group where the rule was, and a block margin
                at a column break is cut, so both column tops align. A flex
                item's margin is not cut; it left ASCII's right column 8 px low. */}
            <div className="flex flex-col gap-6">
              {controls.map((Control, i) => (
                <section
                  key={i}
                  data-customize-system={CUSTOMIZE_SYSTEM_NAME.get(Control) ?? ""}
                  className="hidden flex-col gap-2 has-[[data-field-keys]]:flex"
                >
                  <h5 className="text-xs font-semibold text-foreground">{CUSTOMIZE_SYSTEM_NAME.get(Control)}</h5>
                  <div className="columns-md gap-x-6 [&_[data-field-keys]]:break-inside-avoid [&>*]:contents [&>*>*+*]:mt-4 [&>*>.border-t]:mt-6 [&>*>.border-t]:border-t-0 [&>*>.border-t]:pt-0 [&>*>*:first-child]:mt-0!">
                    <Control styleState={styleState} setStyleState={setStyleState} drawInTiming={drawInTiming} {...handlers} />
                  </div>
                </section>
              ))}
            </div>
          </FieldScopeCtx.Provider>
        )}
      </div>
      {readOnly.length > 0 && (
        <div className="flex max-w-lg flex-col gap-1" data-read-only-fields>
          <span className={fieldLabelClass}>{controls.length ? "Also set, no control here yet" : "Set by this preset, no control here yet"}</span>
          {readOnly.map((x) => (
            <div key={x} className="relative flex justify-between gap-3 pr-14 font-mono text-[10px] text-muted-foreground" data-read-only-field={x}>
              <span>{x}</span>
              <span className="truncate text-foreground">{showValue(presetLiveValue(styleState, take, x))}</span>
              {edited.includes(x) && <EditedMark onReset={() => reset([x])} className="absolute right-0 top-0 flex" />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PanelControl({
  id,
  styleState,
  setStyleState,
  onSelectPreset,
  cameraSpin,
  onSpin,
  onSelectCombo,
  drawInTiming,
}: {
  id: StylePanelId
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
  cameraSpin: number
  onSpin: (deg: number) => void
  onSelectCombo: (c: FusionCombo) => void
  drawInTiming?: DrawInTimingProps
}) {
  switch (id) {
    case "material":
      return <MaterialControl styleState={styleState} setStyleState={setStyleState} />
    case "animation":
      return <AnimationControl styleState={styleState} setStyleState={setStyleState} drawInTiming={drawInTiming} />
    case "texture":
      return <TextureControl styleState={styleState} setStyleState={setStyleState} />

    case "dither":
      return <DitherControl styleState={styleState} setStyleState={setStyleState} />
    case "ascii":
      return <AsciiControl styleState={styleState} setStyleState={setStyleState} />
    case "layers":
      return (
        <LayersControl
          styleState={styleState}
          setStyleState={setStyleState}
          onSelectPreset={onSelectPreset}
        />
      )
    case "fusion":
      return (
        <FusionControl
          styleState={styleState}
          setStyleState={setStyleState}
          onSelectPreset={onSelectPreset}
          cameraSpin={cameraSpin}
          onSpin={onSpin}
          onSelectCombo={onSelectCombo}
        />
      )
    case "presets": {
      const family = styleState.activePresetFamily
      /* `p.enabled` is the shared module's own gate. Geometry and View are
         carried by the consumer-side opt-in above until that module lists them;
         see ROUTED_FAMILIES for why the opt-in lives here and how it collapses. */
      const routed = ROUTED_FAMILIES.some((r) => r.id === family)
      const presets = (PRESET_REGISTRY[family] ?? []).filter((p) => p.enabled || routed)
      const active = findPresetIn(styleState, styleState.activePresetId)
      const activeInFamily = active && active.family === family ? active : undefined
      const mine = (styleState.customPresets ?? []).filter((p) => p.family === family)
      return (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Family</span>
            <select
              value={family}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, activePresetFamily: e.target.value as PresetFamily }))
              }
              className={selectClass}
            >
              {RAIL_FAMILY_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {/* Presets are one tap away — pills, not a buried dropdown.
              A PRESET WITH NO RENDERER AND NO PATCH IS NOT CLICKABLE. The six
              geometry-animation pills were `enabled, implemented: false` with no
              `applies`, so clicking one reset the whole composition to defaults
              and then changed nothing — and the summary chip at the top of the
              app went on to name a preset that had done nothing but delete the
              user's work. They stay ON the rail, labelled "soon", because the
              roadmap they describe is real (PRD Family 14) and hiding it would
              be the deletion §0.7 forbids; they are simply no longer a trap.
              `applyPresetToStyleState` carries the same guard for the harness. */}
          {/* HIS OWN PRESETS LEAD. Saved from Customize, one group per family. */}
          {mine.length > 0 && (
            <div className="flex flex-col gap-1.5" data-mine-group>
              <span className={fieldLabelClass}>Mine</span>
              <div className="flex max-w-lg flex-wrap gap-1.5">
                {mine.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-preset-id={p.id}
                    onClick={() => onSelectPreset(family, p.id)}
                    title={p.description}
                    className={pillClass(activeInFamily?.id === p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className={fieldLabelClass}>Built in</span>
            </div>
          )}
          <div className="flex max-w-lg flex-wrap gap-1.5">
            {presets.map((p) => {
              const selectable = presetIsSelectable(family, p)
              /* WHAT IS ACTUALLY MISSING, IN THE TOOLTIP. A refused view preset
                 names the capability it is waiting on instead of the generic
                 "no renderer yet" — the difference between a roadmap and a dead
                 pill. No view preset is refused today (the video route landed
                 2026-08-03 and took the last blocker with it), so what this
                 branch renders now is the SELECTABLE title: `p.description`.
                 That makes the description the pre-click contract, which is why
                 "Video Preview Export" spells out that it renders every frame
                 and writes a file — the one member whose click is not free. */
              const gaps = family === "view" ? viewPresetBlockers(p.id) : []
              return (
                <button
                  key={p.id}
                  type="button"
                  data-preset-id={p.id}
                  onClick={() => selectable && onSelectPreset(family, p.id)}
                  disabled={!selectable}
                  title={
                    selectable
                      ? p.description
                      : gaps.length
                        ? `${p.description ?? p.label}, waiting on ${gaps[0]}`
                        : `${p.description ?? p.label}, no renderer yet, so this preset is not selectable.`
                  }
                  className={`${pillClass(activeInFamily?.id === p.id)} ${
                    !selectable ? "cursor-not-allowed opacity-45" : ""
                  }`}
                >
                  {p.label}
                  {!selectable && (
                    <span className="ml-1 text-[9px] font-normal opacity-60">soon</span>
                  )}
                </button>
              )
            })}
          </div>
          {activeInFamily?.description && (
            <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
              {activeInFamily.description}
            </p>
          )}
          {/* WHY THE CLICK DID NOTHING, SAID OUT LOUD. A stack-animation preset
              arms the stack and the animation itself, but it cannot put a layer
              IN the stack, and the app opens with all three layer sources off.
              Measured: 0 of 12 move from the app default, 11 of 12 move once
              grain + Bayer + ASCII are on. Without this line the panel's answer
              to "I clicked it and nothing happened" was silence. */}
          {presetStateGap(family, styleState) && (
            <p className="max-w-lg text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              {presetStateGap(family, styleState)}
            </p>
          )}
          {activeInFamily && (
            <PresetCustomize
              key={activeInFamily.id}
              preset={activeInFamily}
              styleState={styleState}
              setStyleState={setStyleState}
              handlers={{ onSelectPreset, cameraSpin, onSpin, onSelectCombo }}
              drawInTiming={drawInTiming}
            />
          )}
        </div>
      )
    }
    default:
      return null
  }
}

export function StylePanelScaffold({
  open,
  activeId,
  styleState,
  setStyleState,
  onSelectPreset,
  onOpenChange,
  onActiveIdChange,
  cameraSpin = 0,
  onSpin,
  onSelectCombo,
  drawInTiming,
}: {
  open: boolean
  activeId: StylePanelId
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
  onOpenChange: (open: boolean) => void
  onActiveIdChange: (id: StylePanelId) => void
  /** Degrees per second the viewport's turntable is running. The camera is not
   *  style state, so it is handed in — see `fusionLinkSleep`'s FusionViewState. */
  cameraSpin?: number
  onSpin: (deg: number) => void
  onSelectCombo: (c: FusionCombo) => void
  /** The draw-in controls for the Animation tab. Absent, the tab shows only
   *  the style-animation settings, as before. */
  drawInTiming?: DrawInTimingProps
}) {
  const active = PANELS.find((p) => p.id === activeId) ?? PANELS[0]
  // Every panel now has a live control (Fusion landed in phases 20/21).
  const hasControl = true

  /* ── THE PANEL NOW SAYS WHEN IT HAS MORE BELOW ───────────────────────────
   *
   * The comment at `fusionEditorRef` already recorded the defect from the
   * inside: *"on a panel that gives no sign it scrolls."* Measured 2026-09-04
   * at 1512 × 982, the first panel a user opens — Material — cut its Intensity
   * slider in half at the body's bottom edge, and Layers held 1272px of
   * content in a 350px window. A hard edge across a slider reads as broken
   * rendering, not as "scroll for more", because macOS hides overlay
   * scrollbars until something moves.
   *
   * A 40px bottom fade, applied ONLY while there is content below, and removed
   * the moment the user reaches the end. Unconditional it would dim the last
   * control on a panel that fits, which is the same defect wearing a gradient.
   */
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const read = () =>
      setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    read()
    el.addEventListener("scroll", read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", read)
      ro.disconnect()
    }
  }, [activeId, open, styleState])
  // The summary strip in app/page.tsx is the drawer's header, so the drawer itself
  // renders nothing when closed — no second header competing with the strip.
  void onOpenChange
  if (!open) return null

  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="flex gap-4 px-4 py-3">
        {/* Tabs */}
        <nav aria-label="Style panel sections" className="flex w-40 shrink-0 flex-col gap-0.5">
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onActiveIdChange(p.id)}
              /* WHICH SECTION IS SHOWING, SAID OUT LOUD.
                 Probed 2026-09-04: all 8 nav buttons carried no role, no
                 aria-selected, no aria-current and no aria-pressed, so a
                 screen reader announced eight identical buttons and nothing
                 about which panel was on screen. The sighted cue is a filled
                 black lozenge; there was no non-visual equivalent.

                 `aria-current` rather than tabs: this sits inside a <nav>, and
                 role="tab" would also owe a tabpanel and arrow-key roving
                 focus, which is a keyboard model this lane is not inventing.
                 Tab already reaches all 8 with a visible ring (45 of 45 tab
                 stops on this page have one). */
              aria-current={p.id === activeId}
              className={`fs-press flex select-none items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                p.id === activeId
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{p.label}</span>
              {p.status === "active" && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    p.id === activeId ? "bg-background" : "bg-foreground"
                  }`}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </nav>

        {/* Active panel body. Keyed so switching tabs re-runs the entrance:
            120ms, 3px rise, strong ease-out (frequent action → reduced motion). */}
        {/* THE CAP GROWS WITH THE WINDOW NOW.
            `max-h-[22rem]` was a flat 352px on every screen. Measured
            2026-09-04 with the panel open, Material selected:

              1512 × 982   body 352, content 399 → the Intensity slider cut
              1440 × 900   body 352, content 399 → same cut
              1280 × 800   body 352, content 399 → same cut

            `min(26rem, calc(100vh - 28rem))` reserves 28rem for the header,
            the style strip and a drawing surface, then gives the panel what is
            left up to 26rem. Re-measured after:

              1512 × 982   body 401, content 399 → no scroll at all
              1440 × 900   body 401, content 399 → no scroll at all
              1280 × 800   body 352 → byte-identical to before
              1440 × 780   body 332, canvas 311 → 331

            No height loses room; the two that had room gain it. Layers still
            scrolls (1272px of stack controls) and that is what the fade is
            for — nothing is trimmed to make the panel fit. */}
        <div
          key={active.id}
          ref={bodyRef}
          className={`fs-panel-enter max-h-[min(26rem,calc(100vh-28rem))] min-h-[14rem] flex-1 overflow-y-auto rounded-xl border border-border bg-muted/10 p-5 ${
            moreBelow
              ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]"
              : ""
          }`}
        >
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-sm font-semibold text-foreground">{active.label}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{active.note}</p>
            {active.status === "reserved" && (
              <span className="select-none rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                coming soon
              </span>
            )}
          </div>

          {/* Live control for this system.
              max-w-2xl is a TEXT measure, and it is the right one for the panels
              whose body is mostly copy. The Fusion panel is the one that is mostly
              CONTROLS — nine relationship pills, three drive pills and three dials
              — and at 672px the pills wrapped to a second line, which pushed the
              dials past the body's max-height and out of sight (caught by the box
              check in scripts/verify/assert-fusion-ui.mjs, not by eye). It gets a
              wider allowance; its own copy blocks stay narrow on their own.
              Presets gets no cap (ANIM-4F): its picker rows and notes carry
              max-w-lg themselves, and Customize under them needs the drawer's
              width for its two columns; at 672px it stacked 2,871px tall. */}
          {hasControl && (
            <div className={`mt-4 ${active.id === "fusion" ? "max-w-4xl" : active.id === "animation" ? "max-w-5xl" : active.id === "presets" ? "" : "max-w-2xl"}`}>
              <PanelControl
                id={active.id}
                styleState={styleState}
                setStyleState={setStyleState}
                onSelectPreset={onSelectPreset}
                cameraSpin={cameraSpin}
                onSpin={onSpin}
                onSelectCombo={onSelectCombo}
                drawInTiming={drawInTiming}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
