R = '/home/user/free-stroke/'
p = R + 'components/dock-shell.tsx'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:70], s.count(a))
    s = s.replace(a, b)


rep('''  const toggle = useCallback((id: RailPanel) => {
    const api = apiRef.current
    if (!api) return
    if (maxRef.current) restore()
    if (id === "export") {
      const g = dockGroup()
      const on = !!g && g.api.isVisible && !collapsedRef.current && g.activePanel?.id === "export"
      if (on) show("timeline")
      else show("export")
      return
    }
    const g = id === "timeline" ? dockGroup() : api.getPanel(id)?.group
    if (!g) return
    g.api.setVisible(!g.api.isVisible)''', '''  /* A RAIL CLICK DOES WHAT ITS BUTTON SAYS (CLOUD-LAYOUT). The button shows
     the panel on or off as the page is now, maximized or not, so the click's
     target is the opposite of that, read BEFORE a maximize is restored. Until
     this, a click while maximized restored first and then flipped the
     restored state: maximize the Drawing, click Timeline ("show") and the
     dock ended up hidden. */
  const railOn = (id: RailPanel): boolean => {
    const api = apiRef.current
    const g = dockGroup()
    if (id === "export") return !!g && g.api.isVisible && !collapsedRef.current && g.activePanel?.id === "export"
    if (id === "timeline") return !!g && g.api.isVisible
    return !!api?.getPanel(id)?.group.api.isVisible
  }
  const toggle = useCallback((id: RailPanel) => {
    const api = apiRef.current
    if (!api) return
    const flip = mutantRef.current === "railflip"
    const want = !railOn(id)
    if (maxRef.current) restore()
    if (id === "export") {
      if (flip ? railOn("export") : !want) show("timeline")
      else show("export")
      return
    }
    const g = id === "timeline" ? dockGroup() : api.getPanel(id)?.group
    if (!g) return
    const next = flip ? !g.api.isVisible : want
    if (g.api.isVisible === next) {
      hold()
      return
    }
    g.api.setVisible(next)''')
rep('''| "unchecked" | "nocatch" | null''', '''| "unchecked" | "nocatch" | "railflip" | null''')
rep('''"unchecked", "nocatch"]''', '''"unchecked", "nocatch", "railflip"]''')
rep('''     "nocatch"         the same, with no catch round `fromJSON` (RA9 must go red)
''', '''     "nocatch"         the same, with no catch round `fromJSON` (RA9 must go red)
     CLOUD-LAYOUT, read by assert-maximize.mjs X10:
     "railflip"        a rail click while maximized restores, then flips the
                       restored state (X10 must go red)
''')
open(p, 'w').write(s)
print("ok")
