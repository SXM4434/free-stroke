// Cuts the real drawing and the real 3D form out of parts/app-default.png. No live app, no :3000.
// FS_HEADED=0 node docs/research-2026-09-26/layout-rethink/mockups/extract.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const HERE = new URL("./", import.meta.url).pathname
const ROOT = new URL("../../../../", import.meta.url).pathname
const { chromium, childPidsOf, isAlive } = await import(ROOT + "scripts/verify/lib/browser.mjs")
mkdirSync(HERE + "img", { recursive: true })
const src = "data:image/png;base64," + readFileSync(HERE + "parts/app-default.png").toString("base64")
const before = new Set(childPidsOf(process.pid))
const browser = await chromium.launch({ label: "layout-mockups-2-extract", args: ["--remote-debugging-port=9461"] })
const pids = childPidsOf(process.pid).filter((p) => !before.has(p))
try {
  const page = await (await browser.newContext()).newPage()
  const out = await page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode()
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height
    const g = c.getContext("2d"); g.drawImage(im, 0, 0)
    const D = 2
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3))
    // 3D view: css 757,92 756x533, minus the edges. Sample the ground at the corners and mid-edges.
    const V = { x: 757 * D, y: 92 * D, w: 756 * D, h: 533 * D }
    const samples = [[30, 30], [V.w - 30, 30], [30, V.h - 30], [V.w - 30, V.h - 30], [V.w / 2, 30], [V.w / 2, V.h - 30], [30, V.h / 2], [V.w - 30, V.h / 2]].map(([x, y]) => px(V.x + x, V.y + y))
    const bg = [0, 1, 2].map((i) => Math.round(samples.reduce((a, s) => a + s[i], 0) / samples.length))
    const d = g.getImageData(V.x, V.y, V.w, V.h).data
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
    for (let y = 20; y < V.h - 20; y++) for (let x = 20; x < V.w - 20; x++) {
      const i = (y * V.w + x) * 4
      const dist = Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]))
      if (dist > 10) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    }
    const prof = { rows: [], cols: [] }
    for (let b = 0; b < V.h; b += 32) { let n = 0; for (let y = b; y < Math.min(V.h, b + 32); y++) for (let x = 0; x < V.w; x += 2) { const i = (y * V.w + x) * 4; if (Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) > 10) n++ } prof.rows.push(n) }
    for (let b = 0; b < V.w; b += 32) { let n = 0; for (let x = b; x < Math.min(V.w, b + 32); x++) for (let y = 0; y < V.h; y += 2) { const i = (y * V.w + x) * 4; if (Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) > 10) n++ } prof.cols.push(n) }
    for (let y = 0; y < V.h; y++) for (let x = V.w - 12; x < V.w; x++) { const i = (y * V.w + x) * 4; d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2] }
    const pad = 40
    const bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad), bw = Math.min(V.w, x1 + pad) - bx, bh = Math.min(V.h, y1 + pad) - by
    // Key the ground out so the form sits on any size of view with the same ground colour.
    const o = document.createElement("canvas"); o.width = bw; o.height = bh
    const og = o.getContext("2d"); const src3 = g.getImageData(V.x + bx, V.y + by, bw, bh); const q = src3.data
    for (let i = 0; i < q.length; i += 4) {
      const dist = Math.max(Math.abs(q[i] - bg[0]), Math.abs(q[i + 1] - bg[1]), Math.abs(q[i + 2] - bg[2]))
      const a = Math.min(1, Math.max(0, (dist - 3) / 22))
      if (a <= 0) { q[i + 3] = 0; continue }
      for (let k = 0; k < 3; k++) q[i + k] = Math.min(255, Math.max(0, Math.round((q[i + k] - bg[k] * (1 - a)) / a)))
      q[i + 3] = Math.round(a * 255)
    }
    og.putImageData(src3, 0, 0)
    // Drawing: the ink inside the drawing panel, css 0..756 x 92..925, dark pixels only.
    const P = { x: 0, y: 92 * D, w: 756 * D, h: 840 * D }
    const e = g.getImageData(P.x, P.y, P.w, P.h).data
    let a0 = 1e9, b0 = 1e9, a1 = -1, b1 = -1
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const i = (y * P.w + x) * 4
      if (e[i] < 200 && x > 8 && x < P.w - 8) { a0 = Math.min(a0, x); b0 = Math.min(b0, y); a1 = Math.max(a1, x); b1 = Math.max(b1, y) }
    }
    const dprof = { rows: [], cols: [] }
    for (let b = 0; b < P.h; b += 32) { let n = 0; for (let y = b; y < Math.min(P.h, b + 32); y++) for (let x = 0; x < P.w; x += 2) { const i = (y * P.w + x) * 4; if (e[i] < 200) n++ } dprof.rows.push(n) }
    for (let b = 0; b < P.w; b += 32) { let n = 0; for (let x = b; x < Math.min(P.w, b + 32); x++) for (let y = 0; y < P.h; y += 2) { const i = (y * P.w + x) * 4; if (e[i] < 200) n++ } dprof.cols.push(n) }
    const lp = 12, lx = Math.max(0, P.x + a0 - lp), ly = P.y + b0 - lp, lw = Math.min(P.w - lx, a1 - a0 + 2 * lp), lh = b1 - b0 + 2 * lp
    const L = document.createElement("canvas"); L.width = lw; L.height = lh
    const lg = L.getContext("2d"); const ld = g.getImageData(lx, ly, lw, lh); const r = ld.data
    for (let i = 0; i < r.length; i += 4) { const lum = (r[i] + r[i + 1] + r[i + 2]) / 3; r[i + 3] = Math.round(255 - lum); r[i] = r[i + 1] = r[i + 2] = 10 }
    lg.putImageData(ld, 0, 0)
    return { dprof, prof, bg, samples, obj: { css: [(V.x + bx) / D, (V.y + by) / D, bw / D, bh / D] }, logo: { css: [lx / D, ly / D, lw / D, lh / D] }, obj3d: o.toDataURL("image/png"), logoPng: L.toDataURL("image/png") }
  }, src)
  delete out.dprof; delete out.prof; {
  writeFileSync(HERE + "img/obj3d.png", Buffer.from(out.obj3d.split(",")[1], "base64"))
  delete out.obj3d; delete out.logoPng
  writeFileSync(HERE + "img/meta.json", JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out)) }
} finally {
  await browser.close()
  for (const p of pids) if (isAlive(p)) { try { process.kill(p, "SIGKILL") } catch {} }
  console.log("browser pids", pids.join(","), "alive after close:", pids.filter(isAlive).join(",") || "none")
}
