/** N6 scratch sweep — high aspects, and the weight question. Feeds the sheet in
 *  docs/verification/nib-2026-08-28/sweep/ and the recommendation in the return. */
import { arm } from "./_nib-measure.mjs"
import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")
const OUT = new URL("../../docs/verification/nib-2026-08-28/sweep/", import.meta.url).pathname
function writeMask(a, name) {
  const S = 3, W = Math.ceil(a.mask.W/S), H = Math.ceil(a.mask.H/S)
  const cv = createCanvas(W,H), ctx = cv.getContext("2d"), img = ctx.createImageData(W,H)
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    let hit=0,n=0
    for(let dy=0;dy<S;dy++)for(let dx=0;dx<S;dx++){const sx=x*S+dx,sy=y*S+dy; if(sx>=a.mask.W||sy>=a.mask.H)continue; n++; hit+=a.mask.mask[sy*a.mask.W+sx]}
    const v=n?255-Math.round(hit/n*255):255, p=(y*W+x)*4
    img.data[p]=v;img.data[p+1]=v;img.data[p+2]=v;img.data[p+3]=255
  }
  ctx.putImageData(img,0,0); writeFileSync(OUT+name, cv.toBuffer("image/png"))
}
const runs = process.argv[2] === "weight"
  ? [
      { nibAspect: 5.0, nibAngleDeg: 30, nibWeight: 1/Math.sqrt(5) },
      { nibAspect: 3.0, nibAngleDeg: 30, nibWeight: 1/Math.sqrt(3) },
      { nibAspect: 2.4, nibAngleDeg: 30, nibWeight: 1/Math.sqrt(2.4) },
    ]
  : [
      { nibAspect: 4.0, nibAngleDeg: 30 },
      { nibAspect: 5.0, nibAngleDeg: 30 },
      { nibAspect: 6.7, nibAngleDeg: 30 },
    ]
for (const o of runs) {
  const a = arm(o)
  const wtag = o.nibWeight ? `-w${o.nibWeight.toFixed(3)}` : ""
  writeMask(a, `aspect-${o.nibAspect}-ang${o.nibAngleDeg}${wtag}.png`)
  console.log(
    `aspect ${o.nibAspect} @${o.nibAngleDeg} w${(o.nibWeight ?? 1).toFixed(3)}  ` +
    `contrastMesh ${a.contrast.toFixed(3)} formula ${a.dbg.nibContrastBuilt.toFixed(3)}  ink ${a.ink}  ` +
    `counters ${a.counters.length}/${a.counterTotal} (min ${a.counterMin})  mean ${a.dbg.nibMeanWidth.toFixed(3)} R  ` +
    `a=${a.dbg.nibSemiMajor.toFixed(3)} b=${a.dbg.nibSemiMinor.toFixed(3)}`)
}
