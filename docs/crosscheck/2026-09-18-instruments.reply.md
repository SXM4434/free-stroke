**All ten files have at least one path that accepts broken or missing input.** Some findings concern individual rows, not the entire file’s verdict. I reproduced the cases below in memory; I did not run the browser batteries against mutated product code.

1. **[lib/paired.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/lib/paired.mjs:40)**

   A thrown error is detected through the truthiness of its first message line. Throwing `""`, or an error whose message starts with a newline, produces an empty `threw` value and **passes**.

   Mutation to a healthy control:
   ```diff
   - () => false
   + () => { throw "" }
   ```
   Reproduced: `makePaired` returned `true`.

   The coercion also accepts `undefined` or `NaN` as valid negative controls, and an asynchronous real arm returning `false` as truthy:
   ```diff
   - () => false
   + () => NaN
   ```
   ```diff
   - () => true
   + async () => false
   ```
   Both reproduced as passing pairs.

2. **[lib/browser.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/lib/browser.mjs:358)**

   The ownership guard uses substring matching. A record ending in `:1` matches a browser whose marker ends in `:10`. That is a different launch, but the guard authorizes its kill.

   Mutation to the mocked browser command:
   ```diff
   - --fs-browser=free-stroke:123:gate:1
   + --fs-browser=free-stroke:123:gate:10
   ```
   Reproduced: the original `reapOrphans()` requested `SIGKILL`. An empty record marker also matches every command.

   Separately, a failed kill still deletes the registry record:
   ```diff
   - process.kill(pid, "SIGKILL")
   + throw Object.assign(new Error("denied"), { code: "EPERM" })
   ```
   Reproduced: no error escaped, the reaped count remained zero, and the record was removed. The surviving orphan loses its retry record.

3. **[run-battery.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/run-battery.mjs:1161)**

   A child’s parsed failing rows do not affect the battery verdict when its exit code is zero. `announcedGreen` deliberately excludes recognized rows, so that backstop does not catch them either.

   Mutation to a child gate:
   ```diff
   - process.exit(fail === 0 ? 0 : 1)
   + process.exit(0)
   ```
   Reproduced with child output `FAIL  broken`: `fails=1`, battery exit **0**.

   An empty child also passes:
   ```diff
   + process.exit(0)
   ```
   Insert that before its assertions. The runner warns about zero rows, then includes the child in `greenRuns` and exits zero.

   **The changed `extraArgsFor` forwarding itself worked** in the calls I checked: the production port reached the fence gate and was withheld from the unrelated export gate.

4. **[run-browser-battery.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/run-browser-battery.mjs:222)**

   The same two child mutations above stay green here. Its final exit expression ignores both `fails` on zero-exit children and `zeroRow`.

   **The guarded transcript write preserves the verdict as intended.** Its catch records and reports the missing log; it does not convert a failing child into a passing one. The final JSON write remains unguarded, but its failure would crash the runner, not pass it.

5. **[assert-drawin-timing.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/assert-drawin-timing.mjs:160)**

   `playUntilHead()` accepts a playhead already frozen inside the band. Neither subsequent default assertion requires movement, successful playback, or a change from `head0`.

   Mutation inside its page callback:
   ```diff
   - const head0 = h.getProgress()
   + h.getProgress = h.getClock = () => 0.4; const head0 = h.getProgress()
   ```
   Reproduced with `setPlaying()` doing nothing: `landed=true`, `playing=false`, and **both default rows pass**.

   This disproves the row’s claim that its sample establishes a moving clock. Other earlier rows could still catch a transport broken throughout the entire run.

6. **[verify-timing-origin.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/verify-timing-origin.mjs:126)**

   `--only=flash` selects `completion_flash`, but cleanup searches for filenames beginning with `flash`. It clears **none** of its existing evidence.

   Mutation to the flash capture:
   ```diff
   - frames: 22,
   + frames: 1,
   ```
   Run with `--only=flash` over an existing complete capture. The old later frames remain, so the downstream minimum-count check can still see a complete arm. I reproduced the filename-selection failure; I did not perform the capture.

   The inverse mismatch also exists: `--only=pulse_armed_at_rest` deletes matching files but selects **no** capture arm, because `want()` accepts `pulse`, not that filename prefix. An unknown selection has no failure guard.

7. **[assert-timing-frames.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/assert-timing-frames.mjs:461)**

   Four separate holes:

   - **Missing state evidence passes.** The missing-file branch calls `check(false, "Preset rail …", detail)`, but the signature is `check(name, ok, detail)`. The message becomes a truthy success value.

     Mutation to the capture writer:
     ```diff
     - join(OUT, "preset-state.json"),
     + join(OUT, "preset-state.missing.json"),
     ```
     With the expected file absent, the original branch reproduced **PASS**, with `false` as the row name.

   - **Missing composition fields compare equal.** Both sides can omit all 36 fields. `JSON.stringify(undefined) === JSON.stringify(undefined)` passes every comparison.

     Mutation to the saved state:
     ```diff
     - JSON.stringify({ afterStack, fromClean }, null, 2),
     + JSON.stringify({ afterStack: { materialPreset: "softGel" }, fromClean: {} }, null, 2),
     ```
     Reproduced: **both preset-state rows pass**.

   - **“Every frame is fresh” checks only the newest PNG.** One newly written PNG admits all older frames, including arms retained by `--only`.

     Mutation after loading an otherwise passing fixture:
     ```diff
     + utimesSync(join(DIR, "pulse_live_01.png"), new Date(0), new Date(0))
     ```
     Provided another PNG remains newer than the source, the provenance predicate stays true. I verified that `newestCapture()` really returns the newest timestamp.

   - **The cutoff step bound cannot fail for finite values.** `activeScale` includes the absolute value of `stepIntoPark` itself. Consequently, `stepIntoPark <= activeScale` is guaranteed.

     Mutation:
     ```diff
     - const e = await envelope("pulse_live")
     + const e = [0, 10, 0, ...Array(29).fill(8)]
     ```
     Reproduced: the stop row and no-snap-back row pass despite the upward jump into the parked tail. The separate `parked < peak - 0.5` condition still has teeth.

8. **[verify-register-light.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/verify-register-light.mjs:110)**

   This is a capture script with an orbit-discovery guard, not a check that the captures contain the lit solid. After finding orbit, it never verifies the state or the image content.

   Proposed live mutation:
   ```diff
   - await scrubTo(solidT)
   + await scrubTo(0)
   ```
   Orbit discovery still succeeds; the capture loop then photographs the wrong transport position without failing an assertion.

   Collected console and page errors are also printed without affecting exit status. I did not execute this live mutation.

9. **[assert-no-em-dashes.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/assert-no-em-dashes.mjs:72)**

   The scanner misses ordinary user-facing syntax:

   ```diff
   - <p>Hello world</p>
   + <p>{"Hello — world"}</p>
   ```
   ```diff
   - <button title="Hello world">OK</button>
   + <button title="Hello — world">OK</button>
   ```
   ```diff
   - label: "Hello world"
   + label: `Hello — world`
   ```

   I injected each form separately into an in-memory read of the current tree. **All four gate rows passed, exit zero, across 122 files.** Escaped `\u2014` and comment-shaped text inside strings also escaped the scanner.

   The allowlist checks filename and text shape, not the debug fence:
   ```diff
   + <p>— Public sentence —</p>
   ```
   Outside the debug block in `viewport-3d.tsx`, that text is still allowed. Reproduced directly through `scanSource()`.

10. **[assert-export-window.mjs](/Users/sebs/Desktop/Projects/free-stroke/scripts/verify/assert-export-window.mjs:948)**

    The changed order-only comparison can accept an **entirely empty harness control**. Empty ink produces `NaN` centroids; the comparison leaves `maxD=0`, making `fires(ctl)` false. That satisfies the paired control.

    Mutation immediately after reading each harness mask:
    ```diff
    + mH[mH.length - 1].m.fill(0)
    ```
    Reproduced: control `minIoU=0`, `maxD=0`, `rightward=0`; the pair passes when its real arm passes. No separate row requires the order-harness film to contain ink or match the order-plan film.

    Two additional false passes:

    - **Missing GLB output:** the mesh census can remain populated while every exported buffer is empty.
      ```diff
      - const glb = async () => await page.evaluate(async () => (await window.__geomDebug.exportBase64()) ?? "")
      + const glb = async () => ""
      ```
      Reproduced: all three hashes become `"none"` and the GLB row passes.

    - **Entirely blank Vanish downloads:** §D checks length and blank tail without requiring positive peak ink. An all-blank film satisfies those checks.
      ```diff
      - const m = inkMask(await pixels(f), ref)
      + const m = opts.ref ? { count: 0 } : inkMask(await pixels(f), ref)
      ```
      This blanks only §D’s measured ink. Its headline predicate reproduced as passing with the expected frame counts. §B’s positive-ink checks do not cover those separately downloaded films.

**Denominator:** I examined **500 of 500 static sites** under this explicit counting rule: 117 assertion/calibration calls, 195 `if`/`catch` sites, 156 ternary expressions, and 32 conditional-loop sites. Compound Boolean terms are not counted separately; loop repetitions are not multiplied; each paired call counts once, with both arms examined.

| File | Assertion calls | Guard/control-flow sites |
|---|---:|---:|
| `lib/paired.mjs` | 0 | 9 |
| `lib/browser.mjs` | 0 | 29 |
| `run-battery.mjs` | 28 | 106 |
| `run-browser-battery.mjs` | 0 | 36 |
| `assert-drawin-timing.mjs` | 25 | 34 |
| `verify-timing-origin.mjs` | 0 | 25 |
| `assert-timing-frames.mjs` | 16 | 37 |
| `verify-register-light.mjs` | 0 | 5 |
| `assert-no-em-dashes.mjs` | 4 | 12 |
| `assert-export-window.mjs` | 44 | 90 |

That is source-review coverage, **not 500 executed mutation tests**.

**What I could not check:** The read-only sandbox prevented filesystem mutation runs and fresh capture output. I therefore did not execute destructive cleanup, actual process kills, mutated browser playback, or mutated ffmpeg exports. Those probes used the original functions with mocked inputs or evaluated their verdict predicates. Only the em-dash cases exercised the complete gate against the current tree with in-memory source substitutions.

The export snapshot comparison behind `--before` is absent from the two runners’ supplied arguments. I could establish that wiring gap, but not whether someone runs that comparison separately. I make no claim that every proposed mutation leaves the entire current browser gate green; the reproduced results establish the affected rows and guards described above.