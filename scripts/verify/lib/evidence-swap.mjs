// EVIDENCE-SWAP — a capture writes to one side, the stored set is replaced on the other.
//
// ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
// The shape was in 65 scripts under `scripts/verify/` and `scripts/capture/`:
//
//   rmSync(OUT, { recursive: true, force: true })
//   mkdirSync(OUT, { recursive: true })
//   ... several minutes of capture ...
//
// Fine on a run that finishes. Catastrophic on one that does not, and lane N9
// measured that rather than argued it: `_probe-word-ladder.mjs --label=gate`
// killed 12 s in left 2 of 41 committed files on disk and `git status`
// reporting 39 deleted. Lane N8 restored them by hand twice the same night.
//
// `_probe-drawin-film.mjs` had written the law down in its own header a week
// earlier and then broke it six lines below:
//
//   "Destroying evidence is strictly worse than writing bad evidence, because
//    a wrong frame can be re-graded and a deleted one cannot."
//
// The comment fixed the PATH the wipe was aimed at. It never fixed the wipe.
//
// ── THE SWAP IS ON COMPLETION, NOT ON THE PASS FLAG ────────────────────────
// N9's judgement, inherited whole: a capture that finished and photographed a
// defect is real evidence and the gate is meant to grade it. Only an INCOMPLETE
// set is worthless, and only that case keeps the prior frames. So `commit()` is
// called where the writing ends, not inside an `if (pass)`.
//
// ── THE ALTERNATIVE WEIGHED AND NOT TAKEN ──────────────────────────────────
// Refuse to wipe any directory whose contents are tracked in git unless a flag
// says otherwise. It guards the same files, it asks git a question on every
// run, and it still leaves a half-written set behind the moment somebody passes
// the flag. Staging fixes the failure mode instead of gating it.
//
// ── WHAT A DEAD RUN LEAVES ─────────────────────────────────────────────────
// Its own frames under `.<name>.staging`, beside the directory it was going to
// replace, untracked and dotted. The next run of the same script clears it.
// That is the whole cost, and it buys back every committed frame.
//
// Usage. Three lines, and every path derived from `OUT` keeps working because
// `OUT` IS the staging directory from the first line of the module:
//
//   import { stageEvidence } from "./lib/evidence-swap.mjs"
//   const FINAL = join(ROOT, "docs", "verification", "thing", LABEL)
//   const EV = stageEvidence(FINAL)
//   const OUT = EV.dir            // and FRAMES/SCRUB/CROPS derived from it, unchanged
//   ...
//   EV.open()                     // where the `rmSync` + `mkdirSync` pair used to be
//   ... every existing write, unchanged ...
//   EV.commit()                   // where the writing ends
//
// `stageEvidence` touches no disk. A gate that IMPORTS a probe for its shared
// constants used to fire a whole capture as a side effect (`_probe-word-ladder`,
// F39), so nothing here is allowed to happen at import time.
import { mkdirSync, rmSync, renameSync, existsSync } from "node:fs"
import { dirname, basename, join } from "node:path"

/**
 * Stage a capture beside the directory it will replace.
 *
 * @param {string} finalDir  absolute path of the stored evidence directory
 * @returns {{ dir: string, final: string, open: () => string, commit: () => string }}
 *   `dir` is where the run writes, `final` is where it lands. `open()` empties
 *   the staging dir. `commit()` swaps it onto `final` and returns `final`, so a
 *   log line can print the real path.
 */
export function stageEvidence(finalDir) {
  const dir = join(dirname(finalDir), `.${basename(finalDir)}.staging`)
  let opened = false
  const open = () => {
    if (!opened) {
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(dir, { recursive: true })
      opened = true
    }
    return dir
  }
  return {
    dir,
    final: finalDir,
    open,
    commit() {
      open()
      // The parent may not exist on a first run, and `renameSync` will not make it.
      mkdirSync(dirname(finalDir), { recursive: true })

      /* TWO RENAMES, NOT ONE, AND THE REASON IS MEASURED.
       *
       * This used to be `rmSync(finalDir)` then `renameSync(dir, finalDir)`.
       * Between those two lines the stored evidence existed NOWHERE, and on
       * 2026-08-28 processes were dying constantly: a shared dev server replaced
       * the document 58 times inside one 120-cell run, four gate runs were lost to
       * destroyed execution contexts, and one lane wrote `lib/` nine seconds into
       * another's capture. A crash in that window takes the committed set with it.
       *
       * That is the defect this whole module was written to stop, one level down.
       *
       * So the old set STEPS ASIDE instead of being deleted. Die after the first
       * rename and `.prev` still holds a complete set. Die after the second and
       * `finalDir` holds the new one. There is no instant at which neither exists. */
      const prev = `${finalDir}.prev`

      /* RECOVER BEFORE DESTROYING, because the first version of this fix worked
       * exactly ONCE.
       *
       * Found by a Codex crosscheck on 2026-08-28 and reproduced here before it
       * was believed: crash one leaves `.prev` holding the only copy, which is
       * the whole point. Crash TWO then called `rmSync(prev)` at the top of this
       * function and deleted it. End state `final=false, prev=false,
       * staging=false` — everything gone, by the guard written to stop exactly
       * that.
       *
       * So `.prev` is only debris when `finalDir` EXISTS. When it does not,
       * `.prev` is not left-over, it IS the stored set, and the first thing this
       * function does is put it back. */
      if (!existsSync(finalDir) && existsSync(prev)) renameSync(prev, finalDir)
      rmSync(prev, { recursive: true, force: true })
      let steppedAside = false
      try {
        renameSync(finalDir, prev)
        steppedAside = true
      } catch (e) {
        // ENOENT is the first run: there is nothing to protect. Anything else is
        // real and must not be swallowed, or this guard becomes the comment it
        // replaced.
        if (e?.code !== "ENOENT") throw e
      }
      renameSync(dir, finalDir)
      if (steppedAside) rmSync(prev, { recursive: true, force: true })
      return finalDir
    },
  }
}


/* ========================================================================== */
/* SELF-TEST — the swap must survive a death between its two renames.         */
/*                                                                            */
/* DISPATCH §2.6: calibrate against a known-bad and REQUIRE it to fail. This   */
/* module exists to stop evidence being destroyed, so its own known-bad is a   */
/* process that dies mid-swap, and the thing it must prove is that a complete  */
/* set is still on disk afterwards.                                            */
/*                                                                            */
/* Channel L discovers this by convention: any `.mjs` under `scripts/verify`   */
/* that is not `assert-*` and parses `--selftest`.                             */
/*   node scripts/verify/lib/evidence-swap.mjs --selftest                      */
/* ========================================================================== */
if (process.argv.slice(2).includes("--selftest")) {
  const { mkdtempSync, writeFileSync, readdirSync, existsSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const fs = await import("node:fs")

  let bad = 0
  const ok = (name, pass, detail) => {
    if (!pass) bad++
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  }
  const seed = (d, names) => {
    mkdirSync(d, { recursive: true })
    for (const n of names) writeFileSync(join(d, n), n)
  }
  const root = mkdtempSync(join(tmpdir(), "evswap-"))

  /* 1 · MUST SURVIVE — the process dies BETWEEN the two renames. -----------
   *
   * No monkeypatching. My first attempt patched `fs.renameSync` on the module
   * object and the injection never fired — this file binds `renameSync` at
   * import, so the patch could not reach it. `renameSync calls: 0`. That is
   * tonight's own lesson arriving one more time: a name is not a binding.
   *
   * So the second rename is made to fail FOR REAL. `open()` creates the staging
   * dir; delete it, and `commit()` gets through the first rename (the old set
   * steps aside) and throws ENOENT on the second. That is precisely the window,
   * reached without touching the code under test. */
  {
    const final = join(root, "a", "stored")
    seed(final, ["old-1.png", "old-2.png", "old-3.png"])
    const ev = stageEvidence(final)
    seed(ev.open(), ["new-1.png"])
    rmSync(ev.dir, { recursive: true, force: true })

    let threw = false
    try { ev.commit() } catch { threw = true }

    const prev = `${final}.prev`
    ok("MUST THROW · the second rename really failed", threw, threw ? "ENOENT on the staging dir" : "commit() returned normally")
    ok(
      "MUST SURVIVE · a death between the renames leaves the OLD set COMPLETE in .prev",
      existsSync(prev) && readdirSync(prev).length === 3,
      existsSync(prev) ? `${readdirSync(prev).length} of 3 file(s) recoverable` : "NO .prev — the old set is GONE",
    )
    ok(
      "CALIBRATION · the pre-change code would have lost them — nothing is at `final` either",
      !existsSync(final),
      "so .prev is the ONLY copy, which is what makes it load-bearing",
    )
  }

  /* 1b · MUST SURVIVE — a SECOND interrupted commit, which the first version of
   * this fix did not. Codex found it; this arm is why it cannot come back. */
  {
    const final = join(root, "a2", "stored")
    seed(final, ["old-1.png", "old-2.png", "old-3.png"])
    const crash = (name) => {
      const ev = stageEvidence(final)
      seed(ev.open(), [name])
      rmSync(ev.dir, { recursive: true, force: true })
      try { ev.commit() } catch { /* the window */ }
    }
    crash("new-1.png")
    const afterOne = existsSync(`${final}.prev`) ? readdirSync(`${final}.prev`).length : 0
    crash("new-2.png")
    const live = existsSync(final) ? readdirSync(final).length : 0
    const kept = existsSync(`${final}.prev`) ? readdirSync(`${final}.prev`).length : 0
    ok(
      "MUST SURVIVE · a SECOND interrupted commit still leaves the old set recoverable",
      Math.max(live, kept) === 3,
      `after one: ${afterOne} in .prev · after two: ${live} at final, ${kept} in .prev`,
    )
  }

  /* 2 · MUST NOT FIRE — a clean commit swaps and leaves no debris. --------- */
  {
    const final = join(root, "b", "stored")
    seed(final, ["old-1.png", "old-2.png"])
    const ev = stageEvidence(final)
    seed(ev.open(), ["new-1.png", "new-2.png", "new-3.png"])
    ev.commit()
    ok(
      "MUST NOT FIRE · a clean commit lands the new set",
      readdirSync(final).length === 3 && readdirSync(final).every((f) => f.startsWith("new-")),
      `${readdirSync(final).join(", ")}`,
    )
    ok("…and leaves no `.prev` behind", !existsSync(`${final}.prev`), `.prev present: ${existsSync(`${final}.prev`)}`)
    ok("…and removes the staging dir", !existsSync(ev.dir), `staging present: ${existsSync(ev.dir)}`)
  }

  /* 3 · MUST NOT FIRE — the first run, where there is nothing to protect. -- */
  {
    const final = join(root, "c", "stored")
    const ev = stageEvidence(final)
    seed(ev.open(), ["new-1.png"])
    ev.commit()
    ok(
      "MUST NOT FIRE · a first run with no stored set commits normally",
      readdirSync(final).length === 1,
      `${readdirSync(final).length} file(s)`,
    )
  }

  rmSync(root, { recursive: true, force: true })
  console.log(`\nevidence-swap --selftest: ${bad === 0 ? "SOUND" : `${bad} arm(s) DID NOT HOLD`}`)
  process.exit(bad === 0 ? 0 : 1)
}
