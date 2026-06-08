"use client"

import { useState } from "react"

/**
 * StylePanelScaffold — Panel Information Architecture shell (Phase 1).
 *
 * PURPOSE: Establish WHERE future style controls will live. The top "Style"
 * summary strip is a compact quick-control bar, NOT the final control surface.
 * Each system below gets its own dedicated panel. This component renders an
 * expandable drawer of placeholder panels — it does NOT implement any renderer
 * or advanced control. Placeholder copy must never claim a renderer exists.
 *
 * Long-term control inventory is documented per section so the IA is explicit.
 */

type PanelId =
  | "material"
  | "texture"
  | "dither"
  | "ascii"
  | "motion"
  | "presets"
  | "layers"
  | "fusion"

interface PanelDef {
  id: PanelId
  label: string
  /** Honest status note — never implies a renderer exists. */
  note: string
  /** Future controls that will live in this panel (documentation/IA). */
  future: string[]
  /** Whether this system's renderer exists yet. */
  status: "substrate" | "later"
}

const PANELS: PanelDef[] = [
  {
    id: "material",
    label: "Material",
    note: "Material presets are active (surface response). Detailed controls land here.",
    status: "substrate",
    future: ["preset", "color", "roughness", "metalness", "clearcoat", "animated material toggle", "shimmer / pulse / sweep"],
  },
  {
    id: "texture",
    label: "Texture",
    note: "Texture controls land here. Procedural texture renderer not implemented yet.",
    status: "later",
    future: ["texture type", "scale", "intensity", "contrast", "lock mode", "animation speed", "direction"],
  },
  {
    id: "dither",
    label: "Dither",
    note: "Dither controls land here. Dither renderer not implemented yet.",
    status: "later",
    future: ["dither type", "scale", "threshold", "contrast", "intensity", "animated dither", "dither speed", "dither direction", "reveal sync"],
  },
  {
    id: "ascii",
    label: "ASCII",
    note: "ASCII controls land here. ASCII renderer not implemented yet.",
    status: "later",
    future: ["character set", "cell size", "density", "contrast", "glyph mapping", "animated ASCII", "scroll speed", "direction", "reveal sync"],
  },
  {
    id: "motion",
    label: "Motion",
    note: "Motion controls will manage animated material / texture / dither / ASCII. Substrate only today.",
    status: "later",
    future: ["style animation enabled", "independent vs reveal synced", "global style speed", "phase", "completion pulse", "stack animation later", "fusion animation later"],
  },
  {
    id: "presets",
    label: "Presets",
    note: "Preset families (texture / dither / ASCII / fusion / …) stay separate. Selection records state; most renderers come later.",
    status: "substrate",
    future: ["per-family preset list", "best-for-mode hints", "apply / preview", "favorites"],
  },
  {
    id: "layers",
    label: "Layers (later)",
    note: "Layer stack panel. Engine not implemented yet.",
    status: "later",
    future: ["layer order", "layer visibility", "layer intensity", "per-layer animation", "blend modes"],
  },
  {
    id: "fusion",
    label: "Fusion (later)",
    note: "Fusion panel. Engine not implemented yet.",
    status: "later",
    future: ["fusion preset", "fusion intensity", "fusion animation", "relationship strength", "chaos / readability", "reveal influence"],
  },
]

export function StylePanelScaffold() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<PanelId>("material")
  const panel = PANELS.find((p) => p.id === active)!

  return (
    <section
      aria-label="Style panels"
      className="shrink-0 border-b border-border bg-muted/10"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="font-medium">Style panels</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          where full controls will live
        </span>
        <span className="ml-auto select-none text-[10px]">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 md:flex-row">
          {/* Panel tabs */}
          <nav
            aria-label="Style panel sections"
            className="flex flex-wrap gap-1 md:w-44 md:flex-col"
          >
            {PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`rounded-md px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                  active === p.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>

          {/* Active panel placeholder body */}
          <div className="flex-1 rounded-md border border-dashed border-border bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground">{panel.label}</h3>
              <span
                className={`select-none rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  panel.status === "substrate"
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {panel.status === "substrate" ? "substrate active" : "renderer later"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{panel.note}</p>
            <div className="mt-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                Future controls
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {panel.future.map((f) => (
                  <li
                    key={f}
                    className="select-none rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
