import { arm } from "./_nib-measure.mjs"
for (const fusion of ["loft", "implicit"]) {
  for (const aspect of [1.0, 1.8]) {
    const a = arm({ fusion, nibAspect: aspect })
    console.log(`fusion ${String(fusion).padEnd(9)} aspect ${aspect}  used=${a.dbg.fusionUsed}  contrastMesh ${a.contrast.toFixed(3)}  fitted ${a.fittedAngleWorldDeg}deg  ink ${a.ink}  axis ${a.axisDeg.toFixed(3)}`)
  }
}
