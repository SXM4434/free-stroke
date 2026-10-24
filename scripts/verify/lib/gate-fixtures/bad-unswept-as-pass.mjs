// KNOWN BAD — channel G's structural half must CATCH this.
//
// It names a channel it could not reach, on an `UNSWEPT` line, and then exits 0
// anyway. That is a skip sold as a pass. Its summary phrasing is deliberately
// one `ALLPASS_RE` has never heard of — "THE LEDGER HOLDS" — because the whole
// point of the structural rule is that a phrase list can only catch the phrases
// somebody already thought of, and `assert-tsc-baseline`'s "TSC BASELINE HOLDS"
// walked through the phrase-matched half for four days.
console.log("PASS  the ledger's frame count is what the model says")
console.log("PASS  the ledger's stillness fraction is above the bar")
console.log("UNSWEPT  the LIVE channel — no dev server on FS_PORT; run `pnpm dev` then re-run")
console.log("\nTHE LEDGER HOLDS")
process.exit(0)
