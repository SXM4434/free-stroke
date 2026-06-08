"use client"

import { useState, useRef } from "react"
import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import DrawingCanvas, { type ExportSettings } from "@/components/drawing-canvas"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import {
  type GeometryMode,
  type ExtrudeParams,
  type SolidParams,
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  EXTRUDE_WIDTH_SLIDER_MIN,
  EXTRUDE_WIDTH_SLIDER_MAX,
  EXTRUDE_WIDTH_SLIDER_STEP,
  mapExtrudeWidthSlider,
  extrudeWidthToSlider,
  EXTRUDE_DEPTH_MULTIPLIER_MIN,
  EXTRUDE_DEPTH_MULTIPLIER_MAX,
  EXTRUDE_DEPTH_MULTIPLIER_STEP,
  SOLID_THICKNESS_SLIDER_MIN,
  SOLID_THICKNESS_SLIDER_MAX,
  SOLID_THICKNESS_SLIDER_STEP,
  SOLID_DEPTH_SLIDER_MIN,
  SOLID_DEPTH_SLIDER_MAX,
  SOLID_DEPTH_SLIDER_STEP,
} from "@/lib/geometry-engines"
import {
  type StyleState,
  DEFAULT_STYLE_STATE,
  MATERIAL_PRESETS,
  TEXTURE_MODES,
  DITHER_PRESETS,
  ASCII_PRESETS,
  type PresetFamily,
  PRESET_FAMILY_OPTIONS,
  PRESET_REGISTRY,
  findPreset,
} from "@/lib/style-system"

const GEOMETRY_MODES: { value: GeometryMode; label: string; disabled: boolean; tooltip?: string }[] = [
  { value: "rod", label: "Rod", disabled: false },
  { value: "extrude", label: "Extrude", disabled: false },
  { value: "solid", label: "Solid", disabled: false },
  { value: "inflate", label: "Inflate", disabled: false },
]

export default function Home() {
  const [rawStrokes, setRawStrokes] = useState<Stroke[]>([])
  const [processedStrokes, setProcessedStrokes] = useState<ProcessedStroke[]>(
    []
  )
  const [geometryMode, setGeometryMode] = useState<GeometryMode>("rod")
  const [extrudeParams, setExtrudeParams] = useState<ExtrudeParams>(DEFAULT_EXTRUDE_PARAMS)
  // Width slider is a normalized t in [0, 1]. The effective half-width
  // stored in `extrudeParams.width` is derived from t via
  // `mapExtrudeWidthSlider`, which uses a quadratic curve so the middle
  // of the slider lands on the previous default (clean), and the messy
  // / breaking widths are reserved for the last ~25% of slider travel.
  // The engine itself still consumes a raw half-width, so engine code
  // does not need to know about the slider at all.
  const [widthSlider, setWidthSlider] = useState<number>(
    extrudeWidthToSlider(DEFAULT_EXTRUDE_PARAMS.width),
  )
  const [solidParams, setSolidParams] = useState<SolidParams>(DEFAULT_SOLID_PARAMS)
  // POST-MVP visual style substrate (Phase 1: rails only). This state is NOT
  // read by any geometry build path — it is display/debug only for now, so
  // updating it never rebuilds geometry, breaks animation, or affects export.
  const [styleState, setStyleState] = useState<StyleState>(DEFAULT_STYLE_STATE)

  // Select a preset by id within the active family. Records the active/last-
  // applied preset and applies the preset's safe `applies` patch. The patch
  // only ever touches INERT style fields (material/texture/dither/ascii state
  // flags) — never geometry, animation, or export — so it is safe to apply for
  // both implemented (material) and not-yet-implemented presets. `implemented`
  // still governs whether a real renderer exists; unimplemented presets only
  // record their sibling state + are clearly labeled "renderer later".
  const handleSelectPreset = (family: PresetFamily, id: string) => {
    const preset = findPreset(id)
    setStyleState((s) => ({
      ...s,
      ...(preset?.applies ?? {}),
      activePresetFamily: family,
      activePresetId: id,
      lastAppliedPresetId: preset?.implemented ? id : s.lastAppliedPresetId,
    }))
  }
  const settingsRef = useRef<ExportSettings>({
    spacing: 4,
    smoothing: true,
    preserveCorners: true,
  })

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Free Stroke
        </h1>

        {/* Geometry mode selector */}
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          {GEOMETRY_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => !mode.disabled && setGeometryMode(mode.value)}
              disabled={mode.disabled}
              title={mode.tooltip}
              className={`relative rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                geometryMode === mode.value
                  ? "bg-background text-foreground shadow-sm"
                  : mode.disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode.label}
              {mode.disabled && (
                <span className="ml-1 text-[9px] font-normal opacity-60">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="w-[70px]" />
      </header>

      {/* Extrude mode controls */}
      {geometryMode === "extrude" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Width — slider is a NORMALIZED t in [0, 1] mapped through a
              quadratic curve to the effective half-width. Mid-slider lands
              on the clean default; only the last ~25% of slider travel
              reaches widths that are known to be chunky/breaking. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Width</span>
            <input
              type="range"
              min={EXTRUDE_WIDTH_SLIDER_MIN}
              max={EXTRUDE_WIDTH_SLIDER_MAX}
              step={EXTRUDE_WIDTH_SLIDER_STEP}
              value={widthSlider}
              onChange={(e) => {
                const t = Number(e.target.value)
                setWidthSlider(t)
                setExtrudeParams((p) => ({ ...p, width: mapExtrudeWidthSlider(t) }))
              }}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-16 select-none font-mono text-[10px] tabular-nums">
              {Math.round(widthSlider * 100)}% · {extrudeParams.width.toFixed(3)}
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Depth — slider value is a width-relative MULTIPLIER (effective
              depth = multiplier × width, clamped). See computeEffectiveExtrudeDepth. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={EXTRUDE_DEPTH_MULTIPLIER_MIN}
              max={EXTRUDE_DEPTH_MULTIPLIER_MAX}
              step={EXTRUDE_DEPTH_MULTIPLIER_STEP}
              value={extrudeParams.depth}
              onChange={(e) => setExtrudeParams((p) => ({ ...p, depth: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-10 select-none font-mono text-[10px]">
              {extrudeParams.depth.toFixed(2)}×
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Bevel toggle */}
          <button
            onClick={() => setExtrudeParams((p) => ({ ...p, bevelEnabled: !p.bevelEnabled }))}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              extrudeParams.bevelEnabled
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Bevel
          </button>
        </div>
      )}

      {/* Solid mode controls */}
      {geometryMode === "solid" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Thickness — slider value is RAW px. The SolidEngine applies a
              nonlinear calibration (see computeSolidEffectiveThicknessPx)
              before feeding the value to canvas lineWidth + H3 walls, so
              the breaking territory lives in the upper end of the slider
              instead of the middle. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Thickness</span>
            <input
              type="range"
              min={SOLID_THICKNESS_SLIDER_MIN}
              max={SOLID_THICKNESS_SLIDER_MAX}
              step={SOLID_THICKNESS_SLIDER_STEP}
              value={solidParams.thickness}
              onChange={(e) => setSolidParams((p) => ({ ...p, thickness: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.thickness}px
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Depth — slider value is RAW world depth. Calibrated through
              computeSolidEffectiveDepth before being used as the H3 Z extent. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={SOLID_DEPTH_SLIDER_MIN}
              max={SOLID_DEPTH_SLIDER_MAX}
              step={SOLID_DEPTH_SLIDER_STEP}
              value={solidParams.depth}
              onChange={(e) => setSolidParams((p) => ({ ...p, depth: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.depth.toFixed(2)}
            </span>
          </label>
        </div>
      )}

      {/* Inflate mode controls — soft inflated stroke (stroke-volume tube loft).
          Reuses the Solid Thickness + Depth state intentionally: Thickness sets
          the stroke's XY radius, and Depth ("Puff") sets cross-section fullness.
          Preview, animation, and GLB export all share one geometry path. */}
      {geometryMode === "inflate" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Thickness</span>
            <input
              type="range"
              min={SOLID_THICKNESS_SLIDER_MIN}
              max={SOLID_THICKNESS_SLIDER_MAX}
              step={SOLID_THICKNESS_SLIDER_STEP}
              value={solidParams.thickness}
              onChange={(e) => setSolidParams((p) => ({ ...p, thickness: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.thickness}px
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Puff</span>
            <input
              type="range"
              min={SOLID_DEPTH_SLIDER_MIN}
              max={SOLID_DEPTH_SLIDER_MAX}
              step={SOLID_DEPTH_SLIDER_STEP}
              value={solidParams.depth}
              onChange={(e) => setSolidParams((p) => ({ ...p, depth: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.depth.toFixed(2)}
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          <span className="select-none font-mono text-[10px] text-muted-foreground">
            Soft inflated stroke · GLB export enabled
          </span>
        </div>
      )}

      {/* Style panel shell (POST-MVP substrate, Phase 1).
          Compact, safe controls only. These update style state immediately but
          DO NOT yet drive any visual effect or rebuild geometry — the rails for
          material / texture / dither / ASCII / sync systems that land later. */}
      <div className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-muted/20 px-4">
        <span className="shrink-0 select-none text-[11px] font-semibold tracking-tight text-foreground">
          Style
        </span>

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="select-none">Material</span>
          <select
            value={styleState.materialPreset}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, materialPreset: e.target.value as StyleState["materialPreset"] }))
            }
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            {MATERIAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="select-none">Texture</span>
          <select
            value={styleState.textureMode}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, textureMode: e.target.value as StyleState["textureMode"] }))
            }
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            {TEXTURE_MODES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {/* Dither — its own sibling system (NOT a texture mode). The select
            sets ditherEnabled + ditherType; "Off" disables dither only. */}
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="select-none">Dither</span>
          <select
            value={styleState.ditherEnabled ? styleState.ditherType : "off"}
            onChange={(e) => {
              const v = e.target.value
              setStyleState((s) =>
                v === "off"
                  ? { ...s, ditherEnabled: false }
                  : { ...s, ditherEnabled: true, ditherType: v as StyleState["ditherType"] },
              )
            }}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <option value="off">Off</option>
            {DITHER_PRESETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        {/* ASCII — its own sibling system (NOT a texture mode). The select
            sets asciiEnabled + asciiCharset; "Off" disables ASCII only. */}
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="select-none">ASCII</span>
          <select
            value={styleState.asciiEnabled ? styleState.asciiCharset : "off"}
            onChange={(e) => {
              const v = e.target.value
              setStyleState((s) =>
                v === "off"
                  ? { ...s, asciiEnabled: false }
                  : { ...s, asciiEnabled: true, asciiCharset: v as StyleState["asciiCharset"] },
              )
            }}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <option value="off">Off</option>
            {ASCII_PRESETS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* Motion — coarse, clear style-animation control. Replaces the old
            ambiguous "Animate" + "Sync Reveal" toggles.
              Off          → style layers static
              Independent  → style animates on its own clock
              Sync to Draw → style timing follows stroke draw-in progress
            Substrate only: no renderer reads motionMode yet. */}
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="select-none">Motion</span>
          <select
            value={styleState.motionMode}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, motionMode: e.target.value as StyleState["motionMode"] }))
            }
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <option value="off">Off (static)</option>
            <option value="independent">Independent clock</option>
            <option value="syncToDraw">Sync to Draw</option>
          </select>
        </label>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* Preset rail (Phase 1). Family selector + preset selector. Material
            presets apply through existing style state; all other families are
            definition-only and clearly marked "renderer later". */}
        {(() => {
          const family = styleState.activePresetFamily
          const presets = (PRESET_REGISTRY[family] ?? []).filter((p) => p.enabled)
          const active = findPreset(styleState.activePresetId)
          const activeInFamily = active && active.family === family ? active : undefined
          return (
            <>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="select-none">Preset</span>
                <select
                  value={family}
                  onChange={(e) =>
                    setStyleState((s) => ({ ...s, activePresetFamily: e.target.value as PresetFamily }))
                  }
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
                >
                  {PRESET_FAMILY_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <select
                value={activeInFamily?.id ?? ""}
                onChange={(e) => e.target.value && handleSelectPreset(family, e.target.value)}
                className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
              >
                <option value="" disabled>
                  Select…
                </option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.implemented ? "" : " (soon)"}
                  </option>
                ))}
              </select>

              {activeInFamily && (
                <span
                  className={`select-none rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    activeInFamily.implemented
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {activeInFamily.implemented ? "active" : "defined · renderer later"}
                </span>
              )}
            </>
          )
        })()}
      </div>

      {/* Honest status line on its own row (keeps the control strip uncluttered). */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/10 px-4 py-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded bg-foreground/10 px-1.5 py-0.5 font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden />
          Live
        </span>
        <span>Material + Presets</span>
        <span className="mx-1 text-border">|</span>
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
          Preview only
        </span>
        <span>Texture, Dither, ASCII, Motion — no visual effect yet (renderers land later)</span>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: drawing canvas */}
        <div className="relative flex-1 border-r border-border">
          <DrawingCanvas
            rawStrokes={rawStrokes}
            setRawStrokes={setRawStrokes}
            processedStrokes={processedStrokes}
            setProcessedStrokes={setProcessedStrokes}
            settingsRef={settingsRef}
          />
        </div>

        {/* Right column: 3D viewport */}
        <div className="flex-1">
          <Viewport3DWrapper processedStrokes={processedStrokes} rawStrokes={rawStrokes} geometryMode={geometryMode} extrudeParams={geometryMode === "extrude" ? extrudeParams : undefined} solidParams={geometryMode === "solid" || geometryMode === "inflate" ? solidParams : undefined} styleState={styleState} settingsRef={settingsRef} />
        </div>
      </div>
    </div>
  )
}
