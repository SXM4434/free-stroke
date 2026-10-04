/* ============================================================================
 * assert-workspace-layouts.mjs: components/workspace/workspaces.ts in Node.
 * Layout rethink phase L4 (his rulings of 2026-09-26: workspaces on dockable
 * panels; the new layout stands as long as every panel can always be
 * rearranged).
 *
 *   node scripts/verify/assert-workspace-layouts.mjs              rows, then every mutant
 *   node scripts/verify/assert-workspace-layouts.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes. Exits 0 only when every row
 * passes, every mutant turns its rows red, and every row has a mutant.
 *
 * WHAT A SAVED LAYOUT MUST BE. components/dock-shell.tsx `layoutFor` hands a
 * saved layout that `layoutProblem` passes straight to dockview's `fromJSON`
 * inside a try/finally with no catch. dockview-core 8.3.1 `_doFromJSON`
 * (node_modules/dockview-core/dist/dockview-core.js) clears the layout and
 * RETHROWS on bad input, and builds each panel from `panels[view]` by that
 * entry's own `id` and `contentComponent`. So "refused or repaired, never
 * crashes" means: whatever `layoutProblem` returns null for is a layout
 * dockview loads as exactly the six panels. LOADABLE below is that rule
 * written out from dockview's code, not from workspaces.ts:
 *   . the root is a branch with a data list (dockview throws otherwise)
 *   . every group id is a string (dockview throws "group id must be of type string")
 *   . each placed view has an object in `panels` (dockview SKIPS a missing one: a lost panel)
 *   . that object's `id` is its key (on the shell's first load dockview builds
 *     the panel under the entry's id) and its `contentComponent` is the panel's
 *     component (dockview-react renders `components[contentComponent]`,
 *     undefined for an unknown name; read from its code, not run)
 * _probe-layout-fromjson.mjs ran dockview-core on one case of each: the two
 * throws and the lost and renamed panels reproduce; a group id used twice
 * loads the six, so it is not on this list.
 *
 * CORPUS. The rows see workspaces.ts and a Map standing in for localStorage.
 * They do NOT run dockview or the shell; assert-workspaces.mjs does, in a
 * browser, and scripts/verify/_probe-layout-fromjson.mjs runs dockview-core's
 * own fromJSON on the layouts this gate builds.
 * ========================================================================== */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")

const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}

/* ---- localStorage, as a Map, with a switch that makes every call throw --- */
const store = new Map()
let blocked = false
const guard = () => {
  if (blocked) throw new Error("SecurityError: storage is blocked")
}
globalThis.window = {
  localStorage: {
    getItem: (k) => (guard(), store.has(k) ? store.get(k) : null),
    setItem: (k, v) => (guard(), void store.set(k, String(v))),
    removeItem: (k) => (guard(), void store.delete(k)),
  },
}

/* ---- the grid, walked here and not by the code under test ------------- */
function leavesOf(node, out = []) {
  if (node && node.type === "leaf") out.push(node)
  else if (node && node.type === "branch" && Array.isArray(node.data)) for (const c of node.data) leavesOf(c, out)
  return out
}

/** Why dockview could not load `l` as exactly the six panels, from dockview's code (see the header). */
function unloadable(l, W) {
  const why = []
  if (!l || typeof l !== "object") return ["not an object"]
  const root = l.grid && l.grid.root
  if (!root || root.type !== "branch" || !Array.isArray(root.data)) return ["the root is not a branch with a data list"]
  const walk = (n) => {
    if (!n || typeof n !== "object") return why.push("a node that is not an object")
    if (n.type === "branch") return Array.isArray(n.data) ? n.data.forEach(walk) : why.push("a branch with no data list")
    if (n.type !== "leaf") return why.push(`a node of type ${String(n.type)}`)
    if (!n.data || typeof n.data !== "object") return why.push("a leaf with no data")
    if (typeof n.data.id !== "string") why.push(`a group id ${JSON.stringify(n.data.id)} that is not a string`)
    if (!Array.isArray(n.data.views) || n.data.views.some((v) => typeof v !== "string")) why.push(`group ${n.data.id}'s views are not a list of names`)
  }
  walk(root)
  const panels = l.panels && typeof l.panels === "object" ? l.panels : {}
  const placed = leavesOf(root).flatMap((g) => (Array.isArray(g.data && g.data.views) ? g.data.views : []))
  for (const v of placed) {
    const p = panels[v]
    // A view this build does not have, with no entry: dockview drops it, a repair.
    if (!W.PANEL_IDS.includes(v) && p === undefined) continue
    if (!p || typeof p !== "object") {
      why.push(`${v} is placed but has no panel entry, which dockview skips`)
      continue
    }
    if (p.id !== v) why.push(`${v}'s entry says id ${JSON.stringify(p.id)}`)
    const comp = p.view && p.view.content ? p.view.content.id : p.contentComponent
    if (!W.PANEL_META[v] || comp !== W.PANEL_META[v].component) why.push(`${v}'s entry says component ${JSON.stringify(comp)}`)
  }
  const ids = new Set(placed.filter((v) => panels[v] && typeof panels[v] === "object").map((v) => panels[v].id))
  const six = W.PANEL_IDS.every((id) => ids.has(id)) && ids.size === W.PANEL_IDS.length
  if (!six) why.push(`dockview would build panels ${[...ids].join(", ")}, not the six`)
  return why
}

/** The fuzz's leaks, grouped by what dockview does with them. */
const KINDS = [
  [/root is not a branch/, "a root that is not a branch (dockview throws)"],
  [/group id .* not a string/, "a group id that is not a string (dockview throws)"],
  [/no panel entry/, "a placed panel whose entry is missing or not an object (dockview drops the panel)"],
  [/entry says id/, "an entry naming another panel id (first load builds a panel by that name)"],
  [/entry says component/, "an entry naming another component (dockview-react renders undefined)"],
  [/views are not a list/, "a group whose views are not a list of names"],
]

/* ---- a seeded generator of corrupt saves ------------------------------- */
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const JUNK = [null, undefined, 0, -1, NaN, "", "ghost", true, [], {}, [1, 2], { type: "leaf" }, { type: "branch", data: null }]
function paths(o, pre = [], out = []) {
  if (o && typeof o === "object") {
    for (const k of Object.keys(o)) {
      out.push([...pre, k])
      paths(o[k], [...pre, k], out)
    }
  }
  return out
}
function corrupt(layout, r) {
  const l = JSON.parse(JSON.stringify(layout))
  const all = paths(l)
  const n = 1 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const p = all[Math.floor(r() * all.length)]
    let o = l
    for (const k of p.slice(0, -1)) {
      if (!o || typeof o !== "object") break
      o = o[k]
    }
    if (!o || typeof o !== "object") continue
    const k = p[p.length - 1]
    const op = r()
    if (op < 0.3) delete o[k]
    else if (op < 0.75) o[k] = JUNK[Math.floor(r() * JUNK.length)]
    else if (op < 0.9 && typeof o[k] === "string") o[k] = "ghost"
    else o[k] = JSON.parse(JSON.stringify(o[Object.keys(o)[Math.floor(r() * Object.keys(o).length)]] ?? null))
  }
  return l
}

const SIZES = [
  [1024, 600],
  [1280, 800],
  [1464, 942],
  [1600, 1500],
  [2560, 1400],
  [3840, 2100],
]
const NARROW = [
  [375, 667],
  [768, 1024],
  [1023, 700],
]

async function runRows() {
  const W = loadTs("components/workspace/workspaces.ts")
  const WS = W.WORKSPACES.map((w) => w.id)

  /* ---- DEFAULTS: serialize, deserialize, list only the six ----------- */
  check("DEFAULTS", "every default, wide and stacked, round-trips through JSON, passes layoutProblem and loads as the six panels", () => {
    let n = 0
    const misses = []
    for (const ws of WS) {
      for (const [w, h, wide] of [...SIZES.map(([w, h]) => [w, h, true]), ...NARROW.map(([w, h]) => [w, h, false])]) {
        n++
        const d = W.defaultLayout(ws, w, h, wide)
        const json = JSON.stringify(d)
        const back = JSON.parse(json)
        const again = JSON.stringify(back) === json
        const problem = W.layoutProblem(back)
        const panelKeys = Object.keys(back.panels).sort().join(",")
        const listsSix = panelKeys === [...W.PANEL_IDS].sort().join(",")
        const placed = leavesOf(back.grid.root).flatMap((g) => g.data.views)
        const onceEach = placed.length === W.PANEL_IDS.length && W.PANEL_IDS.every((id) => placed.filter((v) => v === id).length === 1)
        const actives = leavesOf(back.grid.root).every((g) => g.data.views.includes(g.data.activeView))
        const bad = unloadable(back, W)
        // The shown groups fill the shell: their sizes sum to its extent.
        const root = back.grid.root
        const shown = (ns) => ns.filter((c) => c.visible !== false)
        const sum = (ns) => shown(ns).reduce((a, c) => a + c.size, 0)
        const vSum = sum(root.data)
        const top = root.data.find((c) => c.type === "branch")
        const hSum = top ? sum(top.data) : W.PANEL_IDS.length
        const fills = vSum === h && (!top || hSum === w) && root.data.concat(top ? top.data : []).every((c) => Number.isInteger(c.size) && c.size >= 0)
        if (!(again && problem === null && listsSix && onceEach && actives && bad.length === 0 && fills))
          misses.push(`${ws} ${w}x${h}${wide ? "" : " stacked"}: json ${again}, problem ${problem}, lists ${panelKeys}, once ${onceEach}, actives ${actives}, dockview ${bad.join("/") || "ok"}, fills ${vSum}/${h} ${hSum}/${w}`)
      }
    }
    // Each workspace is its own arrangement, not the same one three times.
    const sigs = new Set(WS.map((ws) => JSON.stringify(W.defaultLayout(ws, 1464, 942, true))))
    row("DEFAULTS", misses.length === 0 && sigs.size === WS.length,
      "every default, wide and stacked, round-trips through JSON, passes layoutProblem and loads as the six panels",
      `${n - misses.length} of ${n} defaults (${WS.length} workspaces, ${SIZES.length} wide and ${NARROW.length} stacked sizes) sound; ${sigs.size} distinct wide arrangements; ${misses.slice(0, 3).join("; ") || "no misses"}`)
  })

  /* ---- KEYS: one storage key per workspace, and nothing else touched ---- */
  check("KEYS", "each workspace saves, reads and deletes under its own key; blocked storage answers and never throws", () => {
    store.clear()
    blocked = false
    const keys = WS.map((ws) => W.storageKey(ws))
    const distinct = new Set([...keys, W.CURRENT_KEY]).size === keys.length + 1
    const prefixed = keys.every((k) => k.startsWith(W.STORAGE_PREFIX)) && W.CURRENT_KEY.startsWith(W.STORAGE_PREFIX)
    const fresh = WS.every((ws) => {
      const r = W.readSaved(ws)
      return r.ok && r.layout === null
    })
    const isolation = []
    for (const ws of WS) {
      const d = W.defaultLayout(ws, 1464, 942, true)
      const before = new Map(store)
      const r = W.writeSaved(ws, d)
      const changed = [...store.keys()].filter((k) => store.get(k) !== before.get(k))
      if (!r.ok || changed.length !== 1 || changed[0] !== W.storageKey(ws)) isolation.push(`${ws} write touched ${changed.join(", ")}`)
      const back = W.readSaved(ws)
      if (!back.ok || JSON.stringify(back.layout) !== JSON.stringify(d) || W.layoutProblem(back.layout) !== null) isolation.push(`${ws} did not read back what it wrote`)
    }
    // Each reads its own: no two saves come back equal (the three defaults differ).
    const reads = new Set(WS.map((ws) => JSON.stringify(W.readSaved(ws).layout)))
    // Delete one, the others keep theirs.
    W.deleteSaved("style")
    const afterDelete = W.readSaved("style").layout === null && W.readSaved("draw").layout !== null && W.readSaved("animate").layout !== null
    // The current workspace: stored, read back, and garbage reads as none.
    W.writeCurrent("animate")
    const cur = W.readCurrent() === "animate"
    store.set(W.CURRENT_KEY, "ghost")
    const garbage = W.readCurrent() === null
    // An unparsable save is answered, and refused, never thrown.
    store.set(W.storageKey("draw"), "{not json")
    const un = W.readSaved("draw")
    const unRefused = un.ok && W.layoutProblem(un.layout) !== null
    // Blocked: every call answers, none throws.
    blocked = true
    let threw = null
    let blockedOk = false
    try {
      blockedOk =
        WS.every((ws) => W.readSaved(ws).ok === false && W.writeSaved(ws, W.defaultLayout(ws, 1464, 942)).ok === false && W.deleteSaved(ws).ok === false) &&
        W.readCurrent() === null
      W.writeCurrent("draw")
    } catch (e) {
      threw = e.message
    }
    blocked = false
    row("KEYS", distinct && prefixed && fresh && isolation.length === 0 && reads.size === WS.length && afterDelete && cur && garbage && unRefused && blockedOk && !threw,
      "each workspace saves, reads and deletes under its own key; blocked storage answers and never throws",
      `keys ${keys.join(", ")} + ${W.CURRENT_KEY}: distinct ${distinct}, prefixed ${prefixed}; fresh reads null: ${fresh}; ${isolation.join("; ") || "each write touched its own key only and read back"}; ` +
      `${reads.size} distinct reads; delete style kept the others: ${afterDelete}; current ${cur}, garbage current null: ${garbage}; unparsable refused: ${unRefused}; blocked answered: ${blockedOk}${threw ? `, THREW ${threw}` : ""}`)
  })

  /* ---- UNKNOWN: a save naming a panel this build lacks is refused, by name */
  check("UNKNOWN", "a save naming an unknown panel, in its panels or its grid, is refused with the name or repaired; one lacking or doubling a panel is refused", () => {
    const base = () => JSON.parse(JSON.stringify(W.defaultLayout("style", 1464, 942, true)))
    const cases = []
    {
      const l = base()
      l.panels.ghost = { id: "ghost", contentComponent: "ghost", title: "Ghost" }
      leavesOf(l.grid.root)[0].data.views.push("ghost")
      cases.push(["an extra panel, placed", l, "ghost", true])
    }
    {
      const l = base()
      l.panels.ghost = { id: "ghost", contentComponent: "ghost", title: "Ghost" }
      cases.push(["an extra panel, unplaced", l, "ghost", true])
    }
    {
      const l = base()
      leavesOf(l.grid.root)[1].data.views.push("ghost")
      cases.push(["an unknown view in the grid only", l, "ghost", true])
    }
    {
      const l = base()
      l.panels.keys = l.panels.timeline
      delete l.panels.timeline
      for (const g of leavesOf(l.grid.root)) g.data.views = g.data.views.map((v) => (v === "timeline" ? "keys" : v))
      cases.push(["a panel renamed (an older build's name)", l, "keys"])
    }
    {
      const l = base()
      delete l.panels.export
      for (const g of leavesOf(l.grid.root)) g.data.views = g.data.views.filter((v) => v !== "export")
      cases.push(["a panel missing", l, "export"])
    }
    {
      const l = base()
      leavesOf(l.grid.root)[0].data.views.push("view3d")
      cases.push(["a panel placed twice", l, "view3d"])
    }
    {
      const l = base()
      for (const g of leavesOf(l.grid.root)) g.data.views = g.data.views.filter((v) => v !== "style")
      cases.push(["a panel listed but not placed", l, "style"])
    }
    const misses = []
    const repairedBy = []
    // Only a name this build lacks may be repaired (dockview drops it); a panel
    // lacking or doubled must be refused.
    for (const [what, l, name, mayRepair = false] of cases) {
      let p
      try {
        p = W.layoutProblem(l)
      } catch (e) {
        p = `THREW ${e.message}`
      }
      const refused = typeof p === "string" && !p.startsWith("THREW") && p.includes(name)
      // Repaired: passed, and dockview drops the unknown view and loads exactly the six.
      const repaired = mayRepair && p === null && unloadable(l, W).length === 0
      if (repaired) repairedBy.push(what)
      if (!refused && !repaired) misses.push(`${what}: ${p}`)
    }
    row("UNKNOWN", misses.length === 0,
      "a save naming an unknown panel, in its panels or its grid, is refused with the name or repaired; one lacking or doubling a panel is refused",
      `${cases.length - misses.length} of ${cases.length} refused naming the panel or repaired (repaired by dockview dropping the view: ${repairedBy.join(", ") || "none"}); ${misses.join("; ") || "no misses"}`)
  })

  /* ---- NOTHROW: layoutProblem answers every corrupt save, never throws --- */
  check("NOTHROW", "layoutProblem returns a reason or null for 6000 corrupt saves and odd values, and never throws", () => {
    const odd = [undefined, null, 0, NaN, "", "x", true, [], {}, { grid: null }, { grid: {} }, { grid: { root: 1 }, panels: {} }, { grid: { root: {} }, panels: [] },
      { grid: { root: { type: "leaf", data: { views: null } } }, panels: Object.fromEntries(W.PANEL_IDS.map((id) => [id, {}])) },
      { grid: { root: { type: "branch", data: [null] } }, panels: Object.fromEntries(W.PANEL_IDS.map((id) => [id, {}])) },
      { __unparsable: "{not json" }]
    const r = rng(20261002)
    let threw = 0
    let bad = 0
    let refused = 0
    let first = ""
    const inputs = [...odd]
    for (const ws of WS) for (let i = 0; i < 2000; i++) inputs.push(corrupt(W.defaultLayout(ws, 1464, 942, true), r))
    for (const l of inputs) {
      try {
        const p = W.layoutProblem(l)
        if (p !== null && (typeof p !== "string" || p.length === 0)) bad++
        if (p) refused++
      } catch (e) {
        threw++
        if (!first) first = `${e.message} on ${JSON.stringify(l).slice(0, 120)}`
      }
    }
    row("NOTHROW", threw === 0 && bad === 0 && refused > inputs.length / 4,
      "layoutProblem returns a reason or null for 6000 corrupt saves and odd values, and never throws",
      `${inputs.length} inputs: ${threw} threw, ${bad} answered with neither a reason nor null, ${refused} refused; ${first || "no throw"}`)
  })

  /* ---- LOADABLE: what layoutProblem passes, dockview loads as the six ---- */
  check("LOADABLE", "every save layoutProblem passes is one dockview loads as exactly the six panels (hand cases and 6000 corrupt saves)", () => {
    const base = (ws = "animate") => JSON.parse(JSON.stringify(W.defaultLayout(ws, 1464, 942, true)))
    const hand = []
    {
      const l = base()
      l.panels.drawing.id = "ghost"
      hand.push(["the drawing entry names panel id ghost", l])
    }
    {
      const l = base()
      l.panels.view3d.contentComponent = "ghost"
      hand.push(["the 3D view entry names component ghost", l])
    }
    {
      const l = base()
      l.panels.style = null
      hand.push(["the style entry is null", l])
    }
    {
      const l = base()
      leavesOf(l.grid.root)[0].data.id = 7
      hand.push(["a group id is a number", l])
    }
    {
      const l = base()
      const all = leavesOf(l.grid.root).flatMap((g) => g.data.views)
      l.grid.root = { type: "leaf", data: { views: all, activeView: all[0], id: "g-all" }, size: 942 }
      hand.push(["the root is a leaf holding all six", l])
    }
    const handMisses = []
    for (const [what, l] of hand) {
      const p = W.layoutProblem(l)
      const u = unloadable(l, W)
      if (p === null && u.length) handMisses.push(`${what}: passed, dockview would ${u.join(" / ")}`)
    }
    const r = rng(77)
    let passed = 0
    let leaks = 0
    const leakKinds = new Map()
    for (const ws of WS)
      for (let i = 0; i < 2000; i++) {
        const l = corrupt(W.defaultLayout(ws, 1464, 942, true), r)
        let p
        try {
          p = W.layoutProblem(l)
        } catch {
          continue // NOTHROW's business
        }
        if (p !== null) continue
        passed++
        const u = unloadable(l, W)
        if (u.length) {
          leaks++
          const kind = KINDS.find(([re]) => re.test(u[0]))?.[1] ?? u[0]
          leakKinds.set(kind, (leakKinds.get(kind) || 0) + 1)
        }
      }
    const kinds = [...leakKinds].map(([k, n]) => `${n}x ${k}`).join("; ")
    row("LOADABLE", handMisses.length === 0 && leaks === 0 && passed > 0,
      "every save layoutProblem passes is one dockview loads as exactly the six panels (hand cases and 6000 corrupt saves)",
      `hand: ${hand.length - handMisses.length} of ${hand.length} refused or loadable; ${handMisses.join("; ") || "no misses"}. ` +
      `corrupt: ${passed} of 6000 passed layoutProblem, ${leaks} of those dockview could not load as the six${kinds ? `: ${kinds}` : ""}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const WF = "components/workspace/workspaces.ts"

/* LOADABLE is red on this branch: layoutProblem passes saves dockview cannot
 * load as the six (LOG.md names it). A row that is already red proves nothing
 * by going red under a mutant, so its must-fail is measured on a FIXED
 * layoutProblem, applied through GATE_MUTATE_FILE and never written to disk:
 * FIX turns LOADABLE green (the row can pass), and FIX without its entry-id
 * check turns it red again (the row sees that check). FIX is also the shape a
 * product fix could take; it is the owner's call, not made here. */
const FIX_AT = "  const seen: string[] = []\n  const walk = (n: unknown): boolean => {"
const FIX_ROOT = `  const root = l.grid.root as { type?: unknown; data?: unknown }
  if (root.type !== "branch" || !Array.isArray(root.data)) return "its grid's root is not a branch"
`
const FIX_ENTRY_ID = `    if (p.id !== id) return \`its \${id} entry names panel \${String(p.id)}\`
`
const fixEntries = (withId) => `  for (const id of PANEL_IDS) {
    const p = (l.panels as Record<string, unknown>)[id] as { id?: unknown; contentComponent?: unknown } | null
    if (!p || typeof p !== "object") return \`its \${id} entry is not a panel\`
${withId ? FIX_ENTRY_ID : ""}    if (p.contentComponent !== PANEL_META[id].component) return \`its \${id} entry names component \${String(p.contentComponent)}\`
  }
`
const FIX_LEAF_AT = "    if (node.type === \"leaf\") {\n"
const FIX_LEAF = FIX_LEAF_AT + "      if (typeof (node.data as { id?: unknown })?.id !== \"string\") return false\n"
const fix = (withId) => [
  { find: FIX_AT, text: FIX_ROOT + fixEntries(withId) + FIX_AT },
  { find: FIX_LEAF_AT, text: FIX_LEAF },
]

const MUTANTS = [
  { name: "MUST-PASS: layoutProblem with the checks dockview needs (FIX) turns LOADABLE green", file: WF, edits: fix(true), green: ["DEFAULTS", "KEYS", "UNKNOWN", "NOTHROW", "LOADABLE"], red: [] },
  { name: "FIX without its entry-id check", file: WF, edits: fix(false), red: ["LOADABLE"] },
  { name: "a default leaves the export panel out of its panels", file: WF, find: "    PANEL_IDS.map((id) => {\n      const m = PANEL_META[id]", text: "    PANEL_IDS.filter((id) => id !== \"export\").map((id) => {\n      const m = PANEL_META[id]", red: ["DEFAULTS"] },
  { name: "the dock's open height is not taken off the top row", file: WF, find: "  const topH = H - dockPx\n", text: "  const topH = H\n", red: ["DEFAULTS"] },
  { name: "every workspace saves under one key", file: WF, find: "export const storageKey = (ws: WorkspaceId) => `${STORAGE_PREFIX}${ws}`", text: "export const storageKey = (ws: WorkspaceId) => `${STORAGE_PREFIX}layout`", red: ["KEYS"] },
  { name: "a write is not guarded", file: WF, find: "  try {\n    window.localStorage.setItem(storageKey(ws), JSON.stringify(layout))\n    return { ok: true }\n  } catch (e) {", text: "  {\n    window.localStorage.setItem(storageKey(ws), JSON.stringify(layout))\n    return { ok: true }\n  } if (0) { const e: unknown = 0;", red: ["KEYS"] },
  { name: "an extra panel is let through", file: WF, find: "  if (extra.length) return `it names", text: "  if (false) return `it names", red: ["UNKNOWN"] },
  { name: "a doubled panel is let through", file: WF, find: "  if (dup.length) return `it places", text: "  if (false) return `it places", red: ["UNKNOWN"] },
  { name: "the grid walk trusts every node", file: WF, find: "    if (!n || typeof n !== \"object\") return false\n    const node", text: "    const node", red: ["NOTHROW"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-workspace-layouts-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const edits = (m.edits || [{ find: m.find, text: m.text }]).map((e) => {
        const at = src.indexOf(e.find)
        if (at < 0 || src.indexOf(e.find, at + 1) >= 0) throw new Error(`mutant text not unique in ${m.file}`)
        return { pos: at, end: at + e.find.length, text: e.text, was: e.find }
      })
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: edits }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        const green = (m.green || []).filter((id) => got.find((x) => x.id === id && x.ok))
        caught = red.length === m.red.length && green.length === (m.green || []).length
        note = m.green
          ? `green: ${green.join(", ") || "none"} of ${m.green.join(", ")}`
          : `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
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
console.log("\nMUST-FAILS (each mutant must turn its rows red; the MUST-PASS must turn them green)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)
