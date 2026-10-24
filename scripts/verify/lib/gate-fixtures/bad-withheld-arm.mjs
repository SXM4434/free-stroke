// FIXTURE — `assert-hero-dials`'s disease, and it is NOT `bad-flag-gated`'s.
//
// Must be judged a GATE by A and B (it emits bare, it is exit-coupled) and
// CAUGHT by channel J.
//
// The difference from `bad-flag-gated.mjs` is the whole reason J exists.
// That fixture hides EVERY judgement behind a flag, so its default run emits
// nothing and channel A catches it. This one emits two perfectly good rows on
// the default invocation — so A is satisfied, the sweep prints `gate`, and the
// battery prints `pass` — while the arm the file is ADVERTISED for sits behind
// `--live`, which no runner passes.
//
// Measured on the real thing, 2026-08-07: `assert-hero-dials.mjs` ran in the
// browser battery in 0.3 s, emitted 4 rows, and never opened Chrome, while
// `docs/README.md:198` called it "every panel control, judged in the state it is
// SHOWN in". Partial coverage reads exactly like full coverage from a scoreboard.
const has = (k) => process.argv.includes(`--${k}`)
const LIVE = has("live")

let failed = 0
const say = (ok, name) => {
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

/* The cheap half — runs bare, and is genuinely correct as far as it goes. */
say(2 + 2 === 4, "the model says the dial is wired")
say([1, 2].length === 2, "the model says both channels exist")

/* THE HALF THE FILE IS FOR. Nothing passes `--live`. */
if (LIVE) {
  say(false, "the REAL control, driven in a REAL browser, moves the REAL render")
}

process.exit(failed ? 1 : 0)
