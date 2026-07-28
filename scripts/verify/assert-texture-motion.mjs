// STRICT test of the user's original complaint: "a lot of the animations for
// textures are hard to notice or just don't do anything".
//
// For every texture pattern, animated at realistic settings, measure the mean
// consecutive-frame change over ink pixels. This is the number that decides
// whether an animation is NOTICEABLE, not merely non-zero.
//
// Thresholds are deliberately strict — a pattern that only clears "detectable
// by diffing" has failed the complaint that prompted this test.
import { chromium } from "playwright-core"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"

const OUT = "/Users/sebs/free-stroke/docs/verification/texture-motion"
mkdirSync(OUT, { recursive: true })
const PATTERNS = ["grain","noise","scanlines","bands","contour","crosshatch","dots","woodgrain","cellular","brushed","craquelure","ripple"]
const DEAD = 1.0      // below this: does nothing
const WEAK = 4.0      // below this: "hard to notice" — still fails the complaint

const stroke=()=>{const p=[];for(let i=0;i<=120;i++){const t=i/120;p.push({x:120+t*620,y:330+Math.sin(t*Math.PI*2.2)*130})}return[p]}
async function px(buf){const img=await loadImage(buf);const c=createCanvas(img.width,img.height);c.getContext("2d").drawImage(img,0,0);return c.getContext("2d").getImageData(0,0,img.width,img.height).data}
function diff(a,b){let s=0,n=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<20&&b[i+3]<20)continue;s+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;n++}return n?s/n:0}

const b=await chromium.launch({channel:"chrome",headless:false,args:["--use-angle=metal"]})
const page=await b.newPage({viewport:{width:1200,height:800}})
await page.goto("http://localhost:3000",{waitUntil:"networkidle"})
await page.waitForFunction(()=>window.__styleHarness&&window.__captureHarness)
await page.evaluate(p=>{window.__styleHarness.injectStrokes(p,{msPerPoint:12});window.__captureHarness.enable()},stroke())
await page.waitForTimeout(1500)
await page.evaluate(()=>window.__revealHarness.setProgress(1))
await page.evaluate(()=>window.__styleHarness.setMode("solid"))
await page.waitForTimeout(900)
await page.evaluate(()=>window.__captureHarness.frontView(1))

let fail=0
console.log("pattern        consecΔ   verdict")
for (const p of PATTERNS) {
  await page.evaluate(t=>window.__styleHarness.setStyle({
    textureEnabled:true, textureMode:t, textureAnimated:true,
    textureScale:1.2, textureIntensity:0.7, textureContrast:0.55,
    textureSpeed:1, textureDirection:"diagonal", textureLockMode:"object",
    motionMode:"independent", textureSyncMode:"independent",
    ditherEnabled:false, asciiEnabled:false, layerStackEnabled:false,
  }), p)
  await page.waitForTimeout(600)
  const shots=[]
  for(let i=0;i<6;i++){await page.waitForTimeout(180);const u=await page.evaluate(()=>window.__captureHarness.grab());shots.push(Buffer.from(u.match(/base64,(.+)/)[1],"base64"))}
  let tot=0,prev=await px(shots[0])
  for(let i=1;i<shots.length;i++){const c=await px(shots[i]);tot+=diff(prev,c);prev=c}
  const m=tot/(shots.length-1)
  const verdict = m<DEAD ? "DOES NOTHING" : m<WEAK ? "HARD TO NOTICE" : "clearly moves"
  if (m<WEAK) fail++
  writeFileSync(`${OUT}/${p}_0.png`,shots[0]); writeFileSync(`${OUT}/${p}_3.png`,shots[3])
  console.log(`${p.padEnd(13)} ${m.toFixed(2).padStart(6)}   ${verdict}`)
}
await b.close()
console.log(fail===0 ? "\nALL TEXTURE ANIMATIONS CLEARLY MOVE" : `\n${fail}/12 STILL FAIL THE USER'S COMPLAINT`)
process.exit(fail===0?0:1)
