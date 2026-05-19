import fs from "node:fs"
const src = fs.readFileSync("lib/geometry-engines.ts", "utf8")
const block = fs.readFileSync(".tmp-inflate-block.txt", "utf8")
const lines = src.split("\n")

// Find start: "/** Inflate-mode debug ..."
let start = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("/** Inflate-mode debug")) {
    start = i
    break
  }
}
if (start < 0) throw new Error("start not found")

// Find end: the closing `},` of InflateEngine's buildPreview, which is the
// last line before `  buildExport(...)`.
let buildExportLine = -1
for (let i = start; i < lines.length; i++) {
  if (lines[i].includes("buildExport(_strokes")) {
    buildExportLine = i
    break
  }
}
if (buildExportLine < 0) throw new Error("buildExport not found")

// Walk back from buildExportLine to find the previous non-empty line which
// should be `  },`.
let endIncl = -1
for (let i = buildExportLine - 1; i > start; i--) {
  if (lines[i].trim() !== "") {
    endIncl = i
    break
  }
}
if (endIncl < 0) throw new Error("end of buildPreview not found")
if (lines[endIncl].trim() !== "},") {
  throw new Error("expected `},` at end, got: " + JSON.stringify(lines[endIncl]))
}

console.log(
  "replacing lines",
  start + 1,
  "..",
  endIncl + 1,
  "(",
  endIncl - start + 1,
  "lines )",
)

const before = lines.slice(0, start).join("\n")
const after = lines.slice(endIncl + 1).join("\n")
const trimmedBlock = block.replace(/\n+$/, "")
const out = before + "\n" + trimmedBlock + "\n" + after
fs.writeFileSync("lib/geometry-engines.ts", out)
console.log("new total lines:", out.split("\n").length)
