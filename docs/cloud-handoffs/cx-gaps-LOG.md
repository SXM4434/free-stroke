DONE

# CX-GAPS

1. Plan committed: `7c6fbebb8`.
2. `validateSession` reports invalid draw-in and fusion values and restores defaults: `d8f84d14d`.
3. Shared SAVED row checks 15 valid values and every wrong type or unknown enum: `cc88134d6`.
4. LISTED and PANEL render components in Node; WIRE runs the viewport hold lines across play and stall frames: `3aa37ca79`.
5. Four named breaks added as must-fails: `558178181`.

Final gates:
- TypeScript: 6 errors, the same six present before the changes.
- `assert-drawin-extras-node`: 26 of 26 rows, 40 of 40 mutants caught.
- `assert-fusion-chaos`: 10 of 10 rows, 20 of 20 mutants caught; no row without a must-fail.
- `assert-key-paths`: 7 of 7 rows, 8 of 8 mutants caught.
- `assert-stroke-timing`: 16 of 16 rows, 12 of 12 mutants caught.

The four specified breaks turned SAVED red in both gates, LISTED red, PANEL red, and WIRE red, respectively. Each named mutant's other rows stayed green.

Could not run browser or server checks because this job forbids both. WIRE runs the extracted CPU lines and does not check GPU output.

Codex-Run: CX-GAPS
