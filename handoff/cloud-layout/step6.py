R = '/home/user/free-stroke/'


def edit(path, pairs):
    s = open(R + path).read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(R + path, 'w').write(s)


# 1. layoutProblem checks what dockview needs to load the six panels.
edit('components/workspace/workspaces.ts', [
    ('''/**
 * Why a saved layout cannot be loaded as it is, or null when it can: every
 * fixed panel present once, nothing else. A layout that names a panel this
 * build does not have, or lacks one, falls back to the default and says which.
 */''', '''/**
 * Why a saved layout cannot be loaded as it is, or null when it can: every
 * fixed panel present once, nothing else. A layout that names a panel this
 * build does not have, or lacks one, falls back to the default and says which.
 *
 * AND WHAT DOCKVIEW NEEDS TO LOAD IT AS THE SIX (CLOUD-LAYOUT, from
 * scripts/verify/assert-workspace-layouts.mjs LOADABLE): dockview-core 8.3.1
 * `fromJSON` throws on a root that is not a branch and on a group id that is
 * not a string, skips a placed panel whose entry is missing, builds a panel
 * under its entry's own `id`, and dockview-react renders the entry's
 * `contentComponent`. Each of those passed here and either crashed every load
 * or loaded without one of the six.
 */'''),
    ('''  const seen: string[] = []
  const walk = (n: unknown): boolean => {''', '''  const root = l.grid.root as { type?: unknown; data?: unknown }
  if (root.type !== "branch" || !Array.isArray(root.data)) return "its grid's root is not a branch"
  for (const id of PANEL_IDS) {
    const p = (l.panels as Record<string, unknown>)[id] as { id?: unknown; contentComponent?: unknown } | null
    if (!p || typeof p !== "object") return `its ${id} entry is not a panel`
    if (p.id !== id) return `its ${id} entry names panel ${String(p.id)}`
    if (p.contentComponent !== PANEL_META[id].component) return `its ${id} entry names component ${String(p.contentComponent)}`
  }
  const seen: string[] = []
  const walk = (n: unknown): boolean => {'''),
    ('''    if (node.type === "leaf") {
''', '''    if (node.type === "leaf") {
      if (typeof (node.data as { id?: unknown })?.id !== "string") return false
'''),
])

# 2. The gate's must-fails, now that LOADABLE is green on the product: each
#    check taken out turns it red again.
s = open(R + 'scripts/verify/assert-workspace-layouts.mjs').read()
a = s[s.index('/* LOADABLE is red on this branch:'):s.index('const MUTANTS = [')]
b = '''/* LOADABLE WAS RED until CLOUD-LAYOUT step 6 put these checks into
 * layoutProblem (the shape this gate's FIX mutant proposed, the controller's
 * call). Its must-fails now take each check back out of the product, one at a
 * time, and LOADABLE must go red for each. */
const NO_ROOT = { find: `  if (root.type !== "branch" || !Array.isArray(root.data)) return "its grid's root is not a branch"\\n`, text: "" }
const NO_ENTRY = { find: "    if (!p || typeof p !== \\"object\\") return `its ${id} entry is not a panel`\\n", text: "    if (!p || typeof p !== \\"object\\") continue\\n" }
const NO_ENTRY_ID = { find: "    if (p.id !== id) return `its ${id} entry names panel ${String(p.id)}`\\n", text: "" }
const NO_COMPONENT = { find: "    if (p.contentComponent !== PANEL_META[id].component) return `its ${id} entry names component ${String(p.contentComponent)}`\\n", text: "" }
const NO_LEAF_ID = { find: "      if (typeof (node.data as { id?: unknown })?.id !== \\"string\\") return false\\n", text: "" }

'''
s = s.replace(a, b)
a = '''  { name: "MUST-PASS: layoutProblem with the checks dockview needs (FIX) turns LOADABLE green", file: WF, edits: fix(true), green: ["DEFAULTS", "KEYS", "UNKNOWN", "NOTHROW", "LOADABLE"], red: [] },
  { name: "FIX without its entry-id check", file: WF, edits: fix(false), red: ["LOADABLE"] },'''
assert s.count(a) == 1
s = s.replace(a, '''  { name: "layoutProblem without its root check", file: WF, edits: [NO_ROOT], red: ["LOADABLE"] },
  { name: "layoutProblem without its entry check", file: WF, edits: [NO_ENTRY], red: ["LOADABLE"] },
  { name: "layoutProblem without its entry-id check", file: WF, edits: [NO_ENTRY_ID], red: ["LOADABLE"] },
  { name: "layoutProblem without its component check", file: WF, edits: [NO_COMPONENT], red: ["LOADABLE"] },
  { name: "layoutProblem without its group-id check", file: WF, edits: [NO_LEAF_ID], red: ["LOADABLE"] },''')
s = s.replace('''console.log("\\nMUST-FAILS (each mutant must turn its rows red; the MUST-PASS must turn them green)")''', '''console.log("\\nMUST-FAILS (each mutant must turn its rows red)")''')
open(R + 'scripts/verify/assert-workspace-layouts.mjs', 'w').write(s)

# 3. A layout that still throws never kills the page: the workspace's default,
#    with a note.
edit('components/dock-shell.tsx', [
    ('''    loadingRef.current = true
    try {
      api.fromJSON(layout, { reuseExistingPanels: mutantRef.current !== "noReuse" })
    } finally {
      loadingRef.current = false
    }
    afterLoad()''', '''    loadingRef.current = true
    try {
      if (mutantRef.current === "nocatch") api.fromJSON(layout, { reuseExistingPanels: true })
      else {
        try {
          api.fromJSON(layout, { reuseExistingPanels: mutantRef.current !== "noReuse" })
        } catch (e) {
          /* NEVER A DEAD APP (CLOUD-LAYOUT). dockview throws on a layout it
             cannot build, after clearing what it had. Whatever got past
             `layoutProblem`, the workspace opens on its default, and says so. */
          const label = WORKSPACES.find((x) => x.id === wsRef.current)?.label ?? "This workspace"
          const why = e instanceof Error ? e.message : String(e)
          window.setTimeout(() =>
            toast.warning(`The ${label} layout could not be loaded`, { description: `${why}. ${label} opens on its default arrangement.` }), 0)
          const { w, h, wide } = shellSize()
          openPxRef.current = null
          api.fromJSON(defaultLayout(wsRef.current, w, h, wide), { reuseExistingPanels: true })
        }
      }
    } finally {
      loadingRef.current = false
    }
    afterLoad()'''),
    ('''| "nodrag" | "locked" | "pinned" | "noreset" | null''', '''| "nodrag" | "locked" | "pinned" | "noreset" | "unchecked" | "nocatch" | null'''),
    ('''"nodrag", "locked", "pinned", "noreset"]''', '''"nodrag", "locked", "pinned", "noreset", "unchecked", "nocatch"]'''),
    ('''     "noreset"         Reset does nothing (RA5)
''', '''     "noreset"         Reset does nothing (RA5)
     CLOUD-LAYOUT, read by assert-rearrange.mjs RA9:
     "unchecked"       a saved layout is loaded without \\`layoutProblem\\`, so a
                       save dockview throws on reaches \\`fromJSON\\` (the row:
                       the page opens on the default, with a note)
     "nocatch"         the same, with no catch round \\`fromJSON\\` (RA9 must go red)
'''),
    ('''      if (mutantRef.current !== "silent")
        toast.warning(''', '''      // A toast raised during the shell's mount is dropped (the page's Toaster
      // mounts after it; see sayStorageBlocked), so it waits a tick.
      if (mutantRef.current !== "silent")
        window.setTimeout(() => toast.warning('''),
    ('''${label} opens on its default arrangement.` })
      return def''', '''${label} opens on its default arrangement.` }), 0)
      return def'''),
    ('''    const problem = mutantRef.current === "silent" ? null : layoutProblem(saved.layout)''',
     '''    const problem = mutantRef.current === "silent" || mutantRef.current === "unchecked" || mutantRef.current === "nocatch" ? null : layoutProblem(saved.layout)'''),
])
s = open(R + 'components/dock-shell.tsx').read().replace('\\`', '`')
open(R + 'components/dock-shell.tsx', 'w').write(s)
print("ok")
