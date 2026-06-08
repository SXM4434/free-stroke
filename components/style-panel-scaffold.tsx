"use client"

import { useState } from "react"

/**
 * StylePanelScaffold
 * ------------------
 * The dedicated, detailed home for each style system's controls. The top
 * "Style" strip in page.tsx is a QUICK-ACCESS summary (pick the active option
 * fast); these panels are where the FULL, fine-grained controls for each
 * system will live as their renderers are built.
 *
 * Today every panel is a documented placeholder: it shows an honest status
 * chip, a one-line note, and the inventory of FUTURE controls planned for that
 * system. No renderer or advanced control is wired up yet — nothing here fakes
 * functionality.
 */

type PanelStatus = "substrate active" | "renderer later"

type PanelDef = {
  id: string
  label: string
  status: PanelStatus
  note: string
  futureControls: string[]
}

const PANELS: PanelDef[] = [
  {
    id: "material",
    label: "Material",
    status: "substrate active",
    note: "Material presets are active (surface response). Detailed controls land here.",
    futureControls: ["preset", "color", "roughness", "metalness", "clearcoat", "animated material toggle", "shimmer / pulse / sweep"],
  },
  {
    id: "texture",
    label: "Texture",
    status: "renderer later",
    note: "Texture controls land here. Procedural texture renderer not implemented yet.",
    futureControls: ["texture type", "scale", "strength", "rotation", "animated texture", "texture speed", "blend mode"],
  },
  {
    id: "dither",
    label: "Dither",
    status: "renderer later",
    note: "Dither controls land here. Dither renderer not implemented yet.",
    futureControls: ["dither type", "scale", "threshold", "contrast", "intensity", "animated dither", "dither speed", "dither direction", "reveal sync"],
  },
  {
    id: "ascii",
    label: "ASCII",
    status: "renderer later",
    note: "ASCII controls land here. ASCII renderer not implemented yet.",
    futureControls: ["charset", "cell size", "contrast", "color mode", "background", "animated ascii", "ascii speed"],
  },
  {
    id: "motion",
    label: "Motion",
    status: "renderer later",
    note: "Motion links style animation timing. No style renderer reads motion yet.",
    futureControls: ["mode (off / independent / sync to draw)", "speed", "easing", "loop", "phase offset", "reveal coupling"],
  },
  {
    id: "presets",
    label: "Presets",
    status: "substrate active",
    note: "Material presets apply today. Non-material preset families are staged for their renderers.",
    futureControls: ["preset family", "apply / reset", "save custom", "preview thumbnails"],
  },
  {
    id: "layers",
    label: "Layers (later)",
    status: "renderer later",
    note: "Layer stack compositing lands here. Compositor not implemented yet.",
    futureControls: ["add / remove layer", "reorder", "per-layer opacity", "blend mode", "stack animation"],
  },
  {
    id: "fusion",
    label: "Fusion (later)",
    status: "renderer later",
    note: "Fusion blends multiple style systems. Fusion renderer not implemented yet.",
    futureControls: ["fusion preset", "mix weights", "animated fusion", "transition curve"],
  },
]

export function StylePanelScaffold() {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(PANELS[0].id)
  const active = PANELS.find((p) => p.id === activeId) ?? PANELS[0]

  return (
    <div className="shrink-0 border-b border-border bg-background">
      {/* Drawer header */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-xs">
        <span className="font-semibold tracking-tight text-foreground">Style panels</span>
        <span className="text-muted-foreground">detailed controls per system</span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="ml-auto rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div className="flex gap-4 px-4 pb-4">
          {/* Tabs */}
          <nav aria-label="Style panel sections" className="flex w-40 shrink-0 flex-col gap-0.5">
            {PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  p.id === activeId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>

          {/* Active panel body */}
          <div className="min-h-[14rem] flex-1 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{active.label}</h3>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  active.status === "substrate active"
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {active.status}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{active.note}</p>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Future controls
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {active.futureControls.map((c) => (
                  <span
                    key={c}
                    className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
