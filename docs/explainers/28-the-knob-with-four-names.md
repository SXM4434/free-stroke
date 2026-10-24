# Explainer 28 — The knob with four names, and the gate that cannot be told which tree it graded

Explainer 27 measured it and this one closes it. The finding, in one sentence:
**35 of the 48 browser gates never imported `scripts/verify/lib/dev-server.mjs`,
hardcoded `http://localhost:3000`, and therefore printed green about a tree the
lane running them had never touched.**

The interesting part is not the sweep. Converting 31 files is mechanical and took
about ten minutes. The interesting part is that **almost every step of proving the
conversion took turned up a second defect underneath it**, and three of those were
invisible to the method that found the first one.

---

## 1. A grep is a claim; a listener is evidence

`dev-server.mjs` was written to close exactly one defect — three names for one
knob — and its own header states the failure plainly:

> *"set the one your muscle memory has and half the battery talks to the shared
> server on :3000 anyway, with no error, and the run is attributed to the wrong
> tree."*

The fix landed in 46 scripts and missed 35 gates. Nothing noticed for four days,
because **on the shared checkout the hardcoded literal and the derived URL are the
same string.** It only bites in a lane — which is precisely where the wrong answer
does the most damage, because a lane exists to measure work nobody has measured yet.

So the first move was not to grep. It was to stand up an HTTP server on the port
named by `FS_PORT`, log every request it receives, and run each gate at it.

**And then to prove the listener could hear anything at all**, because a witness
that can only print zero is worth nothing and this repo has shipped ten
instruments that reported green while measuring nothing:

| probe | imports the resolver | requests seen | names `:3000` in its own output |
|---|---|---|---|
| `assert-carve-graze.mjs` | yes | **2** — `/desk-doodles`, `/favicon.ico` | no |
| `assert-texture-relief.mjs` | no | **0** | **yes** |

That is Lane C's differential reproduced hours later in a different tree, and it
is the calibration. Only after it did the zeros mean anything.

**The second channel came free and is stronger than the first.** A port-blind gate
does not merely fail to appear in the witness log — it *says where it went*, in
its own words:

```
page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
```

Silence proves absence on my port. The stderr line proves presence on somebody
else's. Thirty of the thirty-one named `:3000` on a bare run before conversion.

**Before: 0 of 31 reached the witness. After: 31 of 31.** And the *paths* the
witness logged carry a check nobody had to design — it was never told which gate
should load which page, it only counted what it was asked for:

- exactly **8** gates requested `/desk-doodles`, which is exactly the 8 assigned
  `HERO_URL`;
- `assert-shell-states` logged **3** requests, matching its three `goto` sites, so
  the single `const URL` replacement reached all three;
- `assert-export-live` logged **1**, from the arm that was silent before.

That is the reverse of the number explainer 27 ends on. Lane C's server was asked
for the lab surface **six times in an entire 48-gate battery**; this one was asked
by all thirty-one, by name.

---

## 2. The one that did not, and why it mattered

One gate of the thirty-one broke the pattern: **`assert-export-live` exited 0, with
nine `PASS` rows, having contacted no server at all.**

Its default arm is self-contained — it intercepts `https://free-stroke.test` with
`page.route` and serves its own modules, so it needs no dev server. The `:3000`
literal lives only in the `--app` arm at `:223`, behind a flag **no runner passes.**
That is the class Lane C found in `assert-hero-dials --live`: a gate whose file is
in a sweep while its judgement is not.

It matters here for a narrow methodological reason. Measured bare, its conversion
would have scored **0 requests** — and a careless reading of that zero is *"the
conversion did not take."* The honest reading is *"this gate's server arm is
unreachable from a bare invocation,"* which is a different defect entirely and
belongs to a different lane. The witness now passes `--app` for that one gate and
says why in its source. **A zero has more than one cause, and a table that does not
distinguish them is not a measurement.**

---

## 3. Three defects the string search could never have found

### 3.1 The glob was the bug in the survey

The 31 came from `grep -l "localhost:3000" scripts/verify/assert-*.mjs`. That glob
has the same shape of error as the one explainer 27 §3 records about the battery
runners, which discovered gates with `readdirSync(VERIFY)` and so could not see
`docs/storyboard/tools/assert-moment.mjs`. **A survey scoped by a pattern can only
find what the pattern admits.**

`scripts/verify/geometry-baseline.mjs:121` hardcoded `:3000` and is not an
`assert-*`. `DISPATCH.md` §3 names it as a required step — *"`geometry-baseline.mjs
--save=<label>` before and after anything touching geometry"* — and a lane that
obeyed the rule got a baseline **measuring the canonical tree**, then discarded the
measurement rather than adjusting it.

**A required tool reading the wrong tree is worse than a gate doing it.** A gate
prints one wrong verdict and you can re-run it. A baseline becomes the thing every
later comparison is measured against, so its error propagates forward silently and
signed with authority.

### 3.2 A private copy of the port line opts out of the throw

`assert-tsc-baseline.mjs:59` read `process.env.FS_PORT || 3000` and built its URL
from it. It **honoured the one knob.** By the standard of the original finding it
was already correct, and no search for the string `localhost:3000` would flag it.

It was still wrong, and the reason is the whole design of `dev-server.mjs`. That
module does two things: it resolves the port, and it **throws** when a legacy name
is set, because *"silently ignoring `HERO_URL` would recreate the defect from the
other side: the operator sets it, nothing complains, and every capture is taken
against the wrong server."* A gate with a private copy of the port line gets the
first half and **opts out of the second**. Set `HERO_URL` — the name 24 files used
to carry, and the one muscle memory reaches for — and this gate ignored it in
silence and measured `:3000`.

So the bar moved, and it had to: **"reads `FS_PORT`" is not the bar. "Imports the
shared resolver" is.** The same shape turned up independently in
`assert-drawin-attrs.mjs` the same night, which is the usual sign that a rule is
real rather than a one-off.

### 3.3 A blacklist is short by construction

`dev-server.mjs` threw on `HERO_URL` and `LAB_URL`. It had never heard of `FS_URL`,
which was live in four files the entire time, because **the list was written from
the names that had already caused a problem.** Explainer 27 called that the second
time the blacklist had been found short and drew the right conclusion:

> *"The fix is not 'add `FS_URL` to the list.' It is that a gate must not be able
> to name its own server."*

Both halves shipped here. `FS_URL` joins the throw — an operator who sets it now
gets an error with the replacement command instead of silence — but that is the
courtesy, not the defence. The defence is `assert-one-knob.mjs`, which inverts the
list: **a script may not name a dev server at all.** A whitelist catches the next
name too, and there is always a next name.

---

## 4. The gate that has to survive being inconvenient

Sebs's standing rule for a systemic drift is three things, not one: the sweep, a
gate that fails on the next violation, **and an exemption list that demands a
written reason.** The exemption list is the part that gets skipped, and it is the
part that decides whether the gate is still switched on in a month. A gate with no
exemption mechanism gets disabled the first time it is wrong; one that costs a
single honest sentence stays on.

`assert-one-knob.mjs` has five channels. Two of them exist because writing the
other three exposed a hole.

**It parses instead of grepping, and that is not fastidiousness.**
`assert-drawin-attrs.mjs:155` contains `http://localhost:3000` **inside a comment
describing this very defect**; so does `assert-hero-flatstate.mjs:115`. A grep is
wrong on day one and gets disabled on day two. And the obvious repair — strip the
comments first — is *worse than useless* here, in a way worth stating because it is
so easy to ship: the naive `//.*$` stripper eats `//localhost:3000"` out of
`"http://localhost:3000"`. **It deletes exactly the evidence it was looking for,
and the gate goes quietly green.** So the gate walks the syntax tree and reads only
string and template literals, and one of its negative controls is a file whose only
URLs are in comments.

**Channel D is a ratchet, and its own negative control killed the first version of
it.** Ninety-two hardcoded sites remain in capture tools — `_probe-*`, `verify-*` —
which are the same defect class and a separate sweep's work. Demanding ninety
written reasons would produce ninety copies of one sentence, and padding is what
gets a list deleted. So the count is baselined: it may fall, never rise.

The first implementation counted **files**. Its control was to append a new
hardcoded URL to a script that already had one — and the count did not move. **The
ratchet sat green while the debt grew**, which is the identical shape of lie the
whole lane is about, sitting inside the instrument built to prevent it. Counted in
sites, the same mutation reads `93 vs baseline 92 — FAIL`, and returns to `held`
when reverted.

### 4.1 And the new gate landed in the wrong battery, twice

`run-battery.mjs` decides MODEL vs BROWSER by matching a regex — the launch call
and the two driver package names — **against the file's raw text.** One of
`assert-one-knob`'s mutation fixtures was a string containing a driver import, so
the new gate was classified BROWSER: the model battery refused to run it, and the
browser battery would have run a pure-static analyser against a dev server it does
not need. Caught by `run-battery.mjs --list` before shipping, which printed it
under `BROWSER (49)`.

**The second pass is the one worth recording.** The first fix removed the token
from the fixture and added a comment explaining the rule — *which spelled the
tokens* — and the gate stayed misclassified. The classifier is a grep, and **a
grep cannot tell code from prose.** That is the exact defect this gate refuses to
have, sitting inside the machine that decides which battery runs it. Explainer 27
§3 records "a gate lands in the wrong list and nothing in either output says so";
this is the same failure reached from a new direction, and it is a third instance
of the one pattern this file keeps arriving at: **a comment is source text too.**
`run-battery.mjs` is another lane's file, so this is reported rather than fixed.

**Channel E points the gate at its own exemption list**, and it is the one most
likely to matter in three months. Every ALLOW entry must carry a reason of real
length *and must still actually violate something.* An exemption for a file that no
longer needs one is stale, and a stale exemption is how a list quietly stops
describing reality — the same failure as *"a gate that is loosened and never
re-tested is a gate that has been deleted."* Four of the five current entries read
`OWNERSHIP, NOT JUDGEMENT`, name the lane holding the file, and carry `REMOVE THIS
ENTRY once <lane> lands`. They are meant to expire, and channel E is what notices
when they have.

---

## 5. What a converted gate must be unable to do

A request count proves a gate **reached** the port. It does not prove the gate
**could not have passed without reaching it**, and that is the stronger property —
the one that makes a green row mean something.

So the calibration is the one DISPATCH §2.6 demands: point a converted gate at a
port with **nothing listening** and require it to fail.

The bar is not merely a non-zero exit. It is **zero `PASS` rows and a non-zero
exit**: a gate that emits some passing rows before dying has still made claims
about a tree it never reached, and those rows will be read.

Measured against a dead port, 32 gates: **31 red, and not one of them names
`:3000` any more.** The two channels agree — the witness saw every gate arrive on
the port it was given, and with that port dead every gate refused.

**Two gates' worth of honest exceptions came out of it, and neither was fixed by
moving a bar.**

`assert-tsc-baseline` exits **0** against a dead port, with two passing rows. Its
subject is the typecheck, which needs no server; the HTTP ping is a second channel
whose skip is deliberately **printed**, and the file says why — *"a silent skip is
how `verify-gates` once reported ALL PASS with every geometry gate skipped."* The
skip line reads `no dev server on :3199`, which is itself the proof the conversion
took: it names the port it was handed. What is still worth saying out loud is that
**an operator reading only the exit code cannot tell "typecheck passed and both
routes served" from "typecheck passed, both routes unreachable."** DISPATCH §3's
own rule is *"a SKIP is not a pass"*; here it is not a pass at the row level and is
invisible at the exit level.

And six gates print passing rows *before* failing — `assert-data-safety` prints
**85** — because their model arms legitimately run before their browser arm. The
exit codes are honest and none goes green. But eighty-five green rows scroll past
before the failure, and battery logs are read by eye. Both of these are reported
rather than edited: **changing where a gate prints its rows, or what its exit code
means, is changing the gate** — and the one rule that governs a lane editing
thirty-five checks is that you never relax a bar to make a night look tidy.

---

## 6. The shape of it

Explainer 27 ended on the cheapest available defence: *"make the gate unable to
choose its own subject."* Everything above is one long argument that the same
sentence applies one level up.

| what was measured | what it turned out to measure instead |
|---|---|
| a grep for `localhost:3000` | the gates that spell it that way |
| `grep … assert-*.mjs` | the violations that happen to be gates |
| "does it read `FS_PORT`?" | the half of the contract that isn't the throw |
| a banned-names list | the names somebody already thought of |
| a file-counting ratchet | debt in clean files, never in dirty ones |

Every row is the same error: **an instrument scoped by a description of the
problem, rather than by the problem.** The gate that survives is the one that
inverts it — not *"which of these known-bad shapes is present"* but *"is the one
good shape present."* That is the only version that catches the next name, the next
glob, and the next private copy, none of which anybody has thought of yet.

One footnote on provenance, because it bears on every browser number taken
tonight: **`pnpm dev` (Turbopack) cannot start in an isolated lane tree at all.**
`next.config.mjs` pins `turbopack.root` to the directory holding the config, and
each lane's `node_modules` is a symlink out of that root, which Turbopack treats as
a fatal panic rather than a warning. Every lane fell back to `next dev --webpack`.
Same app source, different bundler. This lane ran in the canonical tree, so its own
measurements are on Turbopack — and that difference is worth knowing before any two
lanes' numbers are compared to each other.
