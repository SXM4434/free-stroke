/**
 * THE PAIRED CONTROL, IN ONE PLACE, AND IT NO LONGER PASSES WHEN IT CRASHES.
 *
 * `paired(name, real, controlName, control, detail)` asserts the pair that makes
 * a row mean something: the REAL check must hold, and the CONTROL, built so it
 * cannot hold, must not. `ok = real && !control`. A row whose control also
 * passes proves nothing, because it would have passed with the feature deleted.
 *
 * 🔴 THE DEFECT THIS FILE CLOSES, measured 2026-09-05. Six gates carried their
 * own copy in four different variants. Two of them, `assert-export-live` and
 * `assert-export-encoders`, wrapped both sides in try/catch:
 *
 *     try { b = control() } catch (e) { be = e.message.split("\n")[0] }
 *     const ok = a && !b
 *
 * When the control THROWS, `b` stays false, so `ok` collapses to `a` and the row
 * PASSES. **A control that crashed was scored as a control that correctly did
 * not fire.** Worse, the detail string is only printed when `!ok`, so the caught
 * error message was discarded in exactly the case that needed it. Demonstrated
 * side by side: a healthy control and a control throwing
 * "cannot read property of undefined" printed the identical PASS line. 14 call
 * sites rode it.
 *
 * ⭐ A CONTROL THAT THROWS IS AN INSTRUMENT FAILURE, NOT A QUIET NEGATIVE. It is
 * the same family as a positive control that skips itself when its subject is
 * deleted, and a one-place gate that goes vacuously true when one place is left.
 * Both sides are reported here, and either one throwing fails the row loudly and
 * says which side threw.
 *
 * ⚠ ON `real` THROWING. That already failed the row before, because `a` stayed
 * false, but it read like an ordinary negative result. It now names itself as a
 * throw, because "the check is wrong" and "the feature is missing" are different
 * problems and cost different afternoons.
 *
 * `row` is injected rather than imported: every gate owns its own reporting and
 * counters, and this file has no business deciding how a line is printed.
 */
export function makePaired(row) {
  return function paired(name, real, controlName, control, detail) {
    /*
     * 🔴 F113 (Codex, 2026-09-18), reproduced 2026-09-22. A throw used to be
     * detected by the TRUTHINESS of its first message line, so `throw ""` or an
     * Error whose message starts with a newline left `threw` empty and the row
     * PASSED. `!!fn()` also coerced: a control returning NaN or undefined scored
     * as a clean negative, and an `async` real side returning false scored as
     * TRUE, because a Promise is truthy. Now any throw is a throw, whatever it
     * carries, and a side must return a real boolean: a Promise, a number,
     * undefined or a string is an instrument failure named in the row.
     */
    const call = (fn) => {
      const bad = (why) => ({ v: false, broke: true, threw: why })
      if (typeof fn === "boolean") return { v: fn, broke: false, threw: null }
      if (typeof fn !== "function") return bad(`not a function or boolean (${typeof fn})`)
      let v
      try {
        v = fn()
      } catch (e) {
        let msg = ""
        try {
          msg = (e && typeof e === "object" && "message" in e ? String(e.message) : String(e)).split("\n").find((l) => l.trim()) ?? ""
        } catch {
          msg = ""
        }
        return bad(msg ? msg : `a throw with no message (${e === null ? "null" : typeof e})`)
      }
      if (v && typeof v.then === "function") {
        // Swallow the eventual rejection so it cannot crash the gate after the row is scored.
        Promise.resolve(v).catch(() => {})
        return bad("returned a Promise; paired() is synchronous, so an async side cannot be scored")
      }
      if (typeof v !== "boolean") return bad(`returned ${Number.isNaN(v) ? "NaN" : v === null ? "null" : typeof v}, not a boolean`)
      return { v, broke: false, threw: null }
    }
    const a = call(real)
    const b = call(control)
    const broke = a.broke || b.broke
    const ok = !broke && a.v && !b.v

    let why = detail ?? ""
    if (!ok) {
      why += ` [real=${a.v}${a.broke ? ` BROKE: ${a.threw}` : ""}`
      why += ` control(${controlName})=${b.v}${b.broke ? ` BROKE: ${b.threw}` : ""}]`
    }
    row(ok, name, why)

    if (b.broke)
      console.log(
        `      the control "${controlName}" THREW or returned a non-boolean. A control that crashes is not a control that ` +
          `stayed silent, and scoring it as one is how a row passes with the feature gone.`,
      )
    else if (a.broke) console.log(`      the REAL side threw or returned a non-boolean, so this row is about the check, not the feature.`)
    else if (!ok && b.v)
      console.log(`      the control "${controlName}" PASSED. This row cannot fail, so it proves nothing`)

    return ok
  }
}
