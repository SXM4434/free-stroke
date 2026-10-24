// DIAGNOSTIC — which way does "presence" run for the stack fade?
//
// Kept because it is the evidence behind the repair in assert-stack-anim.mjs.
// That gate wrapped its fade and delay rows in `Math.abs`, making the DIRECTION
// of a fade untestable, and the obvious fix — drop the abs, assert `last >
// first` — would have been WRONG: the metric was mean luminance, and this
// stack's layers are ink, so the frame gets DARKER as the group arrives.
//
// Run this before changing any threshold in that file. It prints, per fade
// frame, both mean luminance and mean |neighbour Δ| ("detail"), against the two
// arms whose answer is known by construction: `delay_during_` has the group
// ABSENT and `delay_after_` has it PRESENT. On stack-anim-v1 the fade runs
// 10.6 -> 31.1 in detail (monotonic, landing on the known-present arm's 37) while
// luminance falls 120 -> 96. The fade is forward; luminance is the wrong axis.
//
// Usage: node scripts/verify/_diag-fade-direction.mjs
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// WHERE A TOOL READS IS THE SAME DEFECT AS WHICH SERVER IT NAMES, one level over.
// This named a checkout by absolute path, so run from any other tree it reported
// on the shared one's stored frames and said nothing about the caller's. Derived
// from the script's own location; in the shared checkout it resolves
// byte-identically to the string it replaces. `assert-one-knob` could not see
// this class until channel F — the defect is a PATH, not a URL (explainer 27 §1;
// DISPATCH §3; the reference fix is `_probe-drawin-film.mjs:27`).
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "verification", "stack-anim-v1")
async function img(f){const i=await loadImage(join(DIR,f));const c=createCanvas(i.width,i.height);c.getContext("2d").drawImage(i,0,0);return {d:c.getContext("2d").getImageData(0,0,i.width,i.height).data,w:i.width,h:i.height}}
// mean luminance over covered pixels (what presence() does)
function presence(a){let s=0,n=0;for(let i=0;i<a.d.length;i+=4){if(a.d[i+3]<20)continue;s+=(a.d[i]+a.d[i+1]+a.d[i+2])/3;n++}return{lum:n?s/n:0,n}}
// SPATIAL DETAIL: mean |neighbour difference| over covered pixels. A graphic
// layer (scanlines + bayer dither) ADDS high-frequency structure; a bare
// surface has almost none. Independent of whether the layer is dark or light.
function detail(a){const{d,w,h}=a;let s=0,n=0
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;if(d[i+3]<20)continue
  const L=(p)=>(d[p]+d[p+1]+d[p+2])/3
  s+=Math.abs(L(i)-L(i+4))+Math.abs(L(i)-L(i+w*4));n++}
 return n?s/n:0}
const fs=readdirSync(DIR).filter(f=>f.startsWith("fade_")).sort()
console.log("frame        lum     covered   detail")
for(const f of fs){const a=await img(f);const p=presence(a);console.log(`${f.padEnd(12)} ${p.lum.toFixed(2).padStart(7)} ${String(p.n).padStart(9)} ${detail(a).toFixed(3).padStart(8)}`)}
console.log("\n--- delay arms (confounded by reveal progress, shown for completeness) ---")
for(const pre of ["delay_during_","delay_after_"]){
  for(const f of readdirSync(DIR).filter(x=>x.startsWith(pre)).sort()){const a=await img(f);const p=presence(a);console.log(`${f.padEnd(20)} lum ${p.lum.toFixed(2)}  covered ${p.n}  detail ${detail(a).toFixed(3)}`)}
}
