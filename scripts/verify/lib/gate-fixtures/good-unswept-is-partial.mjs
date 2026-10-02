// KNOWN GOOD — channel G's structural half must LEAVE THIS ALONE.
//
// The SAME unreached channel, named the SAME way, and the only difference is the
// one that matters: it exits 3 (PARTIAL) instead of 0, so it is not selling the
// skip as a pass. Without this half the rule is one nobody has watched ACCEPT
// anything, and a rule that has only ever rejected is as useless as one that has
// only ever passed — it just fails in the other direction.
console.log("PASS  the ledger's frame count is what the model says")
console.log("PASS  the ledger's stillness fraction is above the bar")
console.log("UNSWEPT  the LIVE channel — no dev server on FS_PORT; run `pnpm dev` then re-run")
console.log("\nNOT A PASS AND NOT A FAILURE — one channel was never reached.")
process.exit(3)
