R = '/home/user/free-stroke/'
p = R + 'components/dock-shell.tsx'
s = open(p).read()
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:70], s.count(a))
    s = s.replace(a, b)
rep('''      const max = maxRef.current?.id ?? null
      if (max) setMax(null)''', '''      // "maxstuck": the reload under the maximize, as before (X11 must go red).
      const max = mutantRef.current === "maxstuck" ? null : (maxRef.current?.id ?? null)
      if (max) setMax(null)''')
rep('''| "railflip" | null''', '''| "railflip" | "maxstuck" | null''')
rep('''"railflip"]''', '''"railflip", "maxstuck"]''')
rep('''                       restored state (X10 must go red)
''', '''                       restored state (X10 must go red)
     "maxstuck"        crossing 1024 px reloads under the maximize, which stays
                       set with saving off (X11 must go red)
''')
open(p, 'w').write(s)
print("ok")
