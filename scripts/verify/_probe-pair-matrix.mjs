// _probe-pair-matrix.mjs — THE WHOLE DISTANCE MATRIX, not just the closest pair.
//
// `assert-screen-layers` §3 judges ONE pair per mode-and-rail-pair: the closest.
// That is the right thing for a gate — it is the pair that decides the verdict —
// but it is the wrong thing for AUTHORING, and the difference cost this lane a
// cycle. Move the worst pair apart and the gate re-points at whatever was second,
// so a re-author that looks like a win reads as "still WARN, different names".
//
// Measured on the rod texture rail, before any edit: THREE presets were inside
// the 6.0 line, not one pair — scanlines/woodgrain 4.801, scanlines/contourBands
// 5.001, contourBands/woodgrain 5.947. The brief named the first. Fixing only it
// would have surfaced the second, and the report would have been "fixed, and now
// something else is red".
//
// So: every pair, sorted, with SAME RAIL / cross marked — because a cross-family
// pair is judged on MOTION by the gate and a same-rail one cannot be. Read this
// before authoring and again after; the gate is the verdict, this is the map.
//
//   node scripts/verify/_probe-pair-matrix.mjs <label>      # default: iter1
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readFileSync, existsSync } from "node:fs"
const LABEL = process.argv[2] || "iter1"
const R = JSON.parse(readFileSync(`docs/verification/screen-layers/${LABEL}/report.json`,"utf8"))
const CROPS = `docs/verification/screen-layers/${LABEL}/crops/`
async function lum(p){const i=await loadImage(p);const c=createCanvas(i.width,i.height);const g=c.getContext('2d');g.drawImage(i,0,0);const d=g.getImageData(0,0,i.width,i.height).data;const L=new Float32Array(i.width*i.height);for(let k=0,q=0;k<d.length;k+=4,q++)L[q]=0.2126*d[k]+0.7152*d[k+1]+0.0722*d[k+2];return L}
const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length}
const modes=[...new Set(R.map(r=>r.mode))]
for(const mode of modes){
 for(const rails of [["dither","animatedDither"],["texture","animatedTexture"],["ascii","animatedAscii"]]){
  const rows=R.filter(r=>r.mode===mode&&rails.includes(r.rail))
  if(!rows.length) continue
  const keys=[],lums=[]
  for(const r of rows){const p=CROPS+mode+'_'+r.rail+'_'+r.preset+'_macro.png';if(existsSync(p)){keys.push(r.preset+'|'+r.rail);lums.push(await lum(p))}}
  const out=[]
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)out.push([dist(lums[i],lums[j]),keys[i],keys[j]])
  out.sort((a,b)=>a[0]-b[0])
  console.log(`=== ${mode} ${rails[0]}+${rails[1]}`)
  for(const [d,a,b] of out.slice(0,6))console.log('   '+d.toFixed(3).padStart(8)+'  '+a+'  vs  '+b+(a.split('|')[1]===b.split('|')[1]?'   SAME RAIL':'   cross'))
 }
}
