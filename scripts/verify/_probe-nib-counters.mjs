/** N6 — WHICH counter the nib closed, and where the survivors moved.
 *  Counters are matched by CENTROID, not by rank, because a rank list cannot
 *  say which one went: a closed counter renumbers every row below it. */
import { buildMask, counters, MIN_COUNTER } from "./_nib-measure.mjs"

function labelled(mask, W, H, minArea) {
  const out = new Uint8Array(W * H), st = []
  const push = (x, y) => { if (x<0||y<0||x>=W||y>=H) return; const i=y*W+x; if (out[i]||mask[i]) return; out[i]=1; st.push(i) }
  for (let x=0;x<W;x++){push(x,0);push(x,H-1)}
  for (let y=0;y<H;y++){push(0,y);push(W-1,y)}
  while(st.length){const i=st.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1)}
  const seen=new Uint8Array(W*H), regs=[]
  for(let i=0;i<W*H;i++){
    if(mask[i]||out[i]||seen[i])continue
    let a=0,sx=0,sy=0; seen[i]=1; const s2=[i]
    while(s2.length){const j=s2.pop();a++;const x=j%W,y=(j/W)|0;sx+=x;sy+=y
      for(const k of [x+1<W?j+1:-1,x-1>=0?j-1:-1,y+1<H?j+W:-1,y-1>=0?j-W:-1]) if(k>=0&&!seen[k]&&!mask[k]&&!out[k]){seen[k]=1;s2.push(k)}}
    if(a>=minArea)regs.push({area:a,cx:sx/a,cy:sy/a})
  }
  return regs.sort((p,q)=>p.cx-q.cx)
}

const arms = {}
for (const [name, ov] of [["round pen", { nibAspect: 1 }], ["nib 1.8 @ 30", {}], ["nib 1.8 @ 0", { nibAngleDeg: 0 }]]) {
  const m = buildMask(ov)
  arms[name] = { regs: labelled(m.mask, m.W, m.H, Number(process.env.MINA || MIN_COUNTER)), W: m.W, H: m.H }
}
const ref = arms["round pen"].regs
console.log(`\ncounters left-to-right, area in raster texels (MIN_COUNTER = ${MIN_COUNTER})\n`)
const names = Object.keys(arms)
console.log("  x-pos   " + names.map(n => n.padStart(14)).join(""))
for (const r of ref) {
  const row = names.map((n) => {
    const hit = arms[n].regs.find((q) => Math.hypot(q.cx - r.cx, q.cy - r.cy) < 60)
    return (hit ? String(hit.area) : "CLOSED").padStart(14)
  })
  console.log(`  ${String(Math.round(r.cx)).padStart(5)}   ${row.join("")}`)
}
for (const n of names) {
  const a = arms[n].regs.map((r) => r.area)
  console.log(`\n${n}: ${a.length} counters · total ${a.reduce((x, y) => x + y, 0)} · min ${Math.min(...a)} · max ${Math.max(...a)}`)
}
