// Builds the 8 layout boards from one template, renders each at 1512x982 (DPR 2) from file://, then the sheet.
// FS_HEADED=0 node docs/research-2026-09-26/layout-rethink/mockups/build.mjs   (no live app, never :3000)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const HERE = new URL("./", import.meta.url).pathname
const ROOT = new URL("../../../../", import.meta.url).pathname
mkdirSync(HERE + "html", { recursive: true }); mkdirSync(HERE + "png", { recursive: true })

// ── Real data ─────────────────────────────────────────────────────────────
// Stroke bars: the logo's 12 strokes (point counts x 8 ms, 40 ms gaps, as captured), scaled to the 13.1 s take.
const TOTAL = 13.116, NOW = 4.2
const pts = JSON.parse(readFileSync(ROOT + "scripts/capture/logo-strokes.json", "utf8")).polylines.map((l) => l.length)
let t0 = 0; const raw = pts.map((n) => { const s = t0; t0 += n * 8; const e = t0; t0 += 40; return [s, e] })
const K = TOTAL / (raw.at(-1)[1] / 1000)
const BARS = raw.map(([s, e]) => [(s / 1000) * K, (e / 1000) * K])
// Example keys. The app has none set; these show the row size, not real animation.
const LANES = [["Draw", [0, 13.1]], ["Depth", [2.0, 6.5]], ["Turn", [0, 4.2, 9.0, 13.1]], ["Orbit", [3.0, 11.0]], ["Tilt", [5.5]], ["Distance", [0, 12.0]], ["Width", [7.2]]]
const TURN_VALS = [0, 32, -18, 0]
const POLY = JSON.parse(readFileSync(ROOT + "scripts/capture/logo-strokes.json", "utf8")).polylines
const bx = POLY.flat().map((q) => q.x), by = POLY.flat().map((q) => q.y), lp = 12
const VB = [Math.min(...bx) - lp, Math.min(...by) - lp, Math.max(...bx) - Math.min(...bx) + 2 * lp, Math.max(...by) - Math.min(...by) + 2 * lp].map((v) => +v.toFixed(1))
const LOGO = (w) => `<svg class="logo" viewBox="${VB.join(" ")}" style="width:${w}" fill="none" stroke="#0a0a0a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${POLY.map((l) => `<polyline vector-effect="non-scaling-stroke" points="${l.map((q) => q.x + "," + q.y).join(" ")}"/>`).join("")}</svg>`

// ── Icons: one stroke language, 1.6 px, round caps ────────────────────────
const P = {
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>', cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  bars: '<path d="M4 7h9M8 12h11M4 17h7"/>', diamond: '<path d="M12 4l8 8-8 8-8-8z"/>', wave: '<path d="M3 15c3-6 6-6 9 0s6 6 9 0"/>',
  style: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>', export: '<path d="M12 15V4M8 8l4-4 4 4M5 14v5h14v-5"/>',
  layout: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/>', max: '<path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/>',
  restore: '<path d="M9 5v4H5M15 5v4h4M9 19v-4H5M15 19v-4h4"/>', hide: '<path d="M6 12h12"/>', down: '<path d="M7 10l5 5 5-5"/>', right: '<path d="M10 7l5 5-5 5"/>',
  addk: '<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 9v6M9 12h6"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>', info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/>',
  more: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="2.6"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
}
const ic = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`
const PLAY = '<svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" fill="#fff"/></svg>'

// ── Small parts ───────────────────────────────────────────────────────────
const at = (x, y, w, h, cls = "", inner = "", extra = "") => `<div class="abs ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}" >${inner}</div>`
const seg = (opts, on, cls = "") => `<span class="seg ${cls}">${opts.map((o) => `<span class="${o === on ? "on" : ""}">${o}</span>`).join("")}</span>`
const btn = (label, cls = "") => `<span class="btn ${cls}">${label}</span>`
const sep = '<span class="sep"></span>'
const slider = (f, val) => `<div class="slider"><div class="track"><i style="width:${f * 100}%"></i><b style="left:${f * 100}%"></b></div><span class="val mono">${val}</span></div>`
const tc = `<span class="tc mono">0:04.20 <b>/ 0:13.12</b></span>`
const FORM = seg(["Rod", "Extrude", "Solid", "Inflate"], "Rod")
const ENGINE = seg(["Desk Doodles", "Free Stroke"], "Free Stroke")
const EXPORT = btn(`${ic("export")}Export${ic("down")}`, "line")
const topbar = (left, center = "", right = `${ENGINE}${btn("Hero beat", "q")}${EXPORT}`) =>
  `<div class="abs top"><span class="name">free-stroke</span>${left}<span class="grow"></span>${right}</div>` +
  (center ? `<div class="abs row" style="left:0;top:0;width:1512px;height:44px;justify-content:center;pointer-events:none">${center}</div>` : "")
const drawTools = (cls = "btn") => `${btn(ic("undo"), "icon")}${btn(ic("redo"), "icon")}${btn("Clear", "q")}${sep}${btn("Smoothing", "q")}${btn("Corners", "q")}${sep}<span class="btn q">Spacing</span><div style="width:84px">${slider(0.4, "")}</div>`
const floatAt = (pos, inner) => `<div class="abs row" style="${pos};justify-content:center;pointer-events:none"><div class="float">${inner}</div></div>`
const drawing = (x, y, w, h, extra = "", tools = true) => at(x, y, w, h, "draw", `${LOGO("78%")}`, extra + "") +
  (tools ? floatAt(`left:${x}px;top:${y + h - 64}px;width:${w}px;height:44px`, drawTools()) : "")
const stage = (x, y, w, h, cls = "", imgH = 76) => at(x, y, w, h, "stage " + cls, `<img src="../img/obj3d.png" alt="" style="height:${imgH}%">`)
const camTools = `${btn("Top", "q")}${btn("Reset camera", "q")}`

// ── Timeline ──────────────────────────────────────────────────────────────
// rows: [{k:"ruler",h}|{k:"strokes",h}|{k:"lane",name,keys,h}|{k:"strip",i,h}|{k:"sec",label}|{k:"curve",h}]
function track({ w, lc, rows, hits = false }) {
  const tw = w - lc - 12, pad = 10, X = (t) => pad + (t / TOTAL) * (tw - 2 * pad)
  const cell = (h, left, right, cls = "") => `<div class="lane ${cls}" style="height:${h}px"><div class="lname" style="width:${lc}px;flex:none">${left}</div><div style="position:relative;width:${tw}px;height:${h}px">${right}</div></div>`
  const bar = (s, e, y, h, label, cur) => `<div class="bar ${cur ? "cur" : ""}" style="left:${X(s)}px;width:${Math.max(48, X(e) - X(s))}px;top:${y}px;height:${h}px"><span class="e"></span><span class="m">${label}</span><span class="e"></span></div>`
  const out = rows.map((r) => {
    if (r.k === "ruler") {
      let ticks = ""; for (let s = 0; s <= 13; s += 0.5) ticks += `<span class="tick ${s % 1 ? "" : "m"}" style="left:${X(s)}px"></span>` + (s % 1 ? "" : `<span class="lab" style="left:${X(s) + 4}px">${s}${s === 0 ? "s" : ""}</span>`)
      return `<div class="ruler" style="height:${r.h}px;display:flex"><div style="width:${lc}px"></div><div style="position:relative;width:${tw}px">${ticks}<span class="ph-cap" style="left:${X(NOW)}px">4.20</span></div></div>`
    }
    if (r.k === "sec") return `<div class="sec">${r.label}</div>`
    if (r.k === "strokes") return cell(r.h, `<span class="n">Strokes</span><span class="chip">12</span>`, BARS.map(([s, e], i) => bar(s, e, 5, r.h - 10, "", s <= NOW && NOW <= e)).join(""))
    if (r.k === "strip") { const [s, e] = BARS[r.i]; return cell(r.h, `<span class="n muted" style="font-weight:400">Stroke ${r.i + 1}</span>`, bar(s, e, 3, r.h - 6, "", s <= NOW && NOW <= e)) }
    if (r.k === "lane") {
      const y = r.h / 2, ks = r.keys
      let right = ""; for (let i = 0; i + 1 < ks.length; i++) right += `<span class="span" style="left:${X(ks[i])}px;width:${X(ks[i + 1]) - X(ks[i])}px;top:${y}px"></span>`
      if (hits) right += ks.map((t) => `<span class="hit" style="left:${X(t)}px;top:${y}px"></span>`).join("")
      right += ks.map((t) => `<span class="key ${r.name === "Turn" && t === NOW ? "sel" : ""}" style="left:${X(t)}px;top:${y}px"></span>`).join("")
      return cell(r.h, `<span class="n">${r.name}</span><span class="addk" title="Add a ${r.name} key at the playhead">${ic("addk")}</span>`, right)
    }
    if (r.k === "curve") {
      const H = r.h, mid = H / 2, amp = (H / 2 - 28) / 32, ks = LANES[2][1]
      const pts2 = ks.map((t, i) => [X(t), mid - TURN_VALS[i] * amp])
      let d = `M${pts2[0][0]},${pts2[0][1]}`
      for (let i = 1; i < pts2.length; i++) { const [a, b] = [pts2[i - 1], pts2[i]], dx = (b[0] - a[0]) / 3; d += ` C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}` }
      const grid = [-32, -16, 0, 16, 32].map((v) => `<line x1="0" x2="${tw}" y1="${mid - v * amp}" y2="${mid - v * amp}" stroke="rgba(0,0,0,${v ? 0.05 : 0.1})"/><text x="6" y="${mid - v * amp - 4}" font-size="10" fill="#a3a3a3" font-family="Geist Mono">${v}°</text>`).join("")
      const handles = pts2.map(([x, y], i) => `<line x1="${x - 34}" x2="${x + 34}" y1="${y}" y2="${y}" stroke="#a3a3a3" stroke-width="1"/><circle cx="${x - 34}" cy="${y}" r="3" fill="#fff" stroke="#737373"/><circle cx="${x + 34}" cy="${y}" r="3" fill="#fff" stroke="#737373"/><rect x="${x - 4.24}" y="${y - 4.24}" width="8.5" height="8.5" rx="1.5" transform="rotate(45 ${x} ${y})" fill="${ks[i] === NOW ? "#fff" : "#0a0a0a"}" stroke="#0a0a0a" stroke-width="1.6"/>`).join("")
      return cell(H, "", `<svg width="${tw}" height="${H}" style="position:absolute;inset:0">${grid}<path d="${d}" fill="none" stroke="#0a0a0a" stroke-width="1.6"/>${handles}</svg>`, "curve")
    }
  }).join("")
  const phX = lc + X(NOW)
  return `<div style="position:relative">${out}<span class="ph-line" style="left:${phX}px"></span></div>`
}
const lanes = (h) => LANES.map(([name, keys]) => ({ k: "lane", name, keys, h }))
const transport = (right = "", cls = "") => `<div class="tr ${cls}"><span class="play">${PLAY}</span>${tc}${sep}${seg(["Natural", "Authentic"], "Natural")}<span class="chip mono">±0%</span>${sep}${seg(["0.5x", "1x", "2x"], "1x")}${sep}<span class="tgl on"><i></i>Draw-in</span>${MORE}<span class="grow"></span>${right}</div>`
const MORE = `<span class="btn icon q" title="Debug, speed note">${ic("more")}</span>`
const TIMING_RIGHT = `${btn("Perform", "q")}${btn("Ripple", "q")}<span class="chip mono">13.1 s</span>`
const CAMERA = btn(`${ic("camera")}Camera${ic("down")}`, "q")

// ── Draw-in ───────────────────────────────────────────────────────────────
const drawIn = () => `<div class="form">
  <div class="f"><label>Order</label><span class="select" style="margin:0;width:170px">As drawn ${ic("down", "ico")}</span></div>
  <div class="f"><label>Overlap</label>${slider(0, "0%")}</div>
  <div class="f"><label>Start</label><div class="pair">${seg(["Start together", "End together"], "Start together")}</div></div>
  <div class="f"><label>Split by</label>${seg(["Groups", "Strokes"], "Strokes")}</div>
  <div class="f"><label>Direction</label>${seg(["Start → end", "End → start", "Alternating"], "Start → end")}</div>
  <div class="f"><label>Ends</label>${seg(["Grow", "Travel", "Vanish", "Shrink"], "Grow")}</div>
  <div class="f"><label>Window</label>${slider(0.35, "0.35")}</div>
  <div class="f"><label>Look</label><div class="pair">${seg(["Lit object", "Flat ink"], "Lit object")}${seg(["Ones", "Twos"], "Ones")}</div></div>
  <div class="f"><label>Turn</label>${slider(0.5, "0°")}</div>
  <div class="f"><label>Delay</label>${slider(0, "0 s")}</div>
  <div class="f"><label>Easing</label>${seg(["Linear", "Ease in", "Ease out", "Ease in-out"], "Ease out")}</div>
  <div class="f"><label>Playback</label>${seg(["Reverse", "Loop"], "Loop")}</div></div>`

// ── Style families, Presets open ──────────────────────────────────────────
const SW = { Ink: "radial-gradient(circle at 35% 30%,#5a5a5a,#0a0a0a 62%)", "Soft Gel": "radial-gradient(circle at 35% 30%,#fff,#c3dbff 45%,#7ea9ee)", "Matte Clay": "radial-gradient(circle at 35% 30%,#e9bca4,#bf7a5b 72%)", "Glossy Plastic": "radial-gradient(circle at 32% 28%,#fff 0 8%,#ff6b5e 24%,#c42a1e)", Rubber: "radial-gradient(circle at 35% 30%,#707070,#262626 72%)", Signal: "radial-gradient(circle at 35% 30%,#ffd28f,#ff7a1a 62%)", Ceramic: "radial-gradient(circle at 32% 28%,#fff 0 10%,#efebe5 42%,#cdc5ba)", Chalk: "radial-gradient(circle at 35% 30%,#fcfcf9,#dcd8cf 78%)", Chrome: "linear-gradient(160deg,#fdfdfd,#9a9a9a 45%,#eeeeee 56%,#6b6b6b)", Gold: "radial-gradient(circle at 32% 28%,#fff4c7 0 8%,#e8b84a 36%,#98680f)", Wax: "radial-gradient(circle at 35% 30%,#fff9e8,#ead6a8 72%)", Neon: "radial-gradient(circle at 35% 30%,#ffd9ff,#ff3df2 46%,#b000c8)", Iridescent: "conic-gradient(from 200deg,#9be7ff,#d7b3ff,#ffc6e0,#fff1b8,#b8ffd9,#9be7ff)" }
const FAMS = [["Material", "Ink"], ["Texture", "None"], ["Dither", "Off"], ["ASCII", "Off"], ["Animation", "Static"], ["Layers", "Off"], ["Fusion", "None"]]
const families = () => `<div class="fam">${FAMS.map(([n, v]) => `<div class="fr"><span class="n">${n}</span><span class="v">${v}</span>${ic("right")}</div>`).join("")}
  <div class="fr open"><span class="n">Presets</span><span class="v">None</span>${ic("down")}</div>
  <div class="fopen"><div class="select"><span><span class="muted" style="font-weight:400">Family</span>&nbsp; Material</span>${ic("down", "ico")}</div>
  <div class="swatches">${Object.entries(SW).map(([n, g]) => `<div class="sw"><i style="background:${g}${n === "Neon" ? ";box-shadow:0 0 10px rgba(255,61,242,.45)" : ""}"></i>${n}</div>`).join("")}</div></div></div>`

// ── Dockable panel parts (B) ──────────────────────────────────────────────
const panel = (x, y, w, h, title, headMid, body, { m = "", maxed = false } = {}) => at(x, y, w, h, "panel", `<div class="ph"><span class="grip"></span>${title ? `<span class="t">${title}</span>` : ""}${headMid}<span class="grow"></span><span class="hb">${ic(maxed ? "restore" : "max")}</span><span class="hb">${ic("hide")}</span></div><div class="pb" ${m ? `data-m="${m}"` : ""}>${body}</div>`)
const RAIL_ITEMS = [["Drawing", "pen"], ["3D view", "cube"], ["Timeline", "bars"], ["Draw-in", "wave"], ["Style", "style"], ["Export", "export"]]
const rail = (on, layoutOpen = false) => at(0, 44, 48, 938, "rail", RAIL_ITEMS.map(([n, i]) => `<span class="ri ${on.includes(n) ? "on" : ""}" title="${n}">${ic(i)}</span>`).join("") + `<span class="grow"></span><span class="ri ${layoutOpen ? "on" : ""}" title="Layout">${ic("layout")}</span>`)
const bodyFill = (inner) => `<div style="position:absolute;inset:0">${inner}</div>`

// ── Label chip: direction, state, and the measured sizes ─────────────────
const note = (pos, dir, state) => `<div class="note" style="${pos}"><div class="h">${dir} · ${state}</div><div class="s" data-sizes>…</div></div>`
const MEASURE = `<script>
document.fonts.ready.then(() => {
  const f = (m) => { const e = document.querySelector('[data-m="' + m + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.width) + ' × ' + Math.round(r.height) + (e.dataset.hdr ? ' + ' + e.dataset.hdr + ' header' : '') }
  const d = document.body.dataset
  const draw = d.draw || f('draw') || 'hidden', tl = d.tl || f('tl') || 'none'
  document.querySelectorAll('[data-sizes]').forEach((s) => s.innerHTML = 'Drawing panel ' + draw + '<br>Timeline ' + tl)
  document.body.dataset.ready = '1'
})</script>`
const page = (id, inner, bodyData = "") => `<!doctype html><html><head><meta charset="utf-8"><title>${id}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=block" rel="stylesheet">
<link rel="stylesheet" href="../mock.css"></head><body ${bodyData}><div class="board">${inner}</div>${MEASURE}</body></html>`

// ── The 8 states ──────────────────────────────────────────────────────────
const Y = 44, H = 938
const S = {}
S["A-draw"] = page("A-draw", topbar("", seg(["Draw", "Style", "Animate"], "Draw", "ws lg")) +
  drawing(0, Y, 900, H, "", true).replace('class="abs draw"', 'class="abs draw" data-m="draw"') +
  stage(900, Y, 612, H, "divl", 52) +
  floatAt(`left:916px;top:${Y + 16}px`, FORM) + `<div class="abs" style="right:16px;top:${Y + 16}px"><div class="float">${camTools}</div></div>` +
  floatAt(`left:900px;top:${982 - 68}px;width:612px;height:48px`, `<span class="play" style="width:28px;height:28px">${PLAY}</span>${tc}${sep}${btn("Animate" + ic("right"), "q")}`) +
  note(`left:16px;top:${Y + 16}px`, "A · Workspaces", "Draw"))

S["A-style"] = page("A-style", topbar("", seg(["Draw", "Style", "Animate"], "Style", "ws lg")) +
  at(0, Y, 360, H, "", `<div class="ph2">Style<span class="grow"></span>${btn("Edit these values", "q")}</div>${families()}`, "box-shadow:inset -1px 0 0 var(--hair)") +
  stage(360, Y, 1152, H, "", 70) +
  at(376, Y + 16, 216, 120, "thumb", `${LOGO("84%")}<span class="cap">Drawing · open in Draw</span>`).replace('class="abs thumb"', 'class="abs thumb" data-m="draw"') +
  floatAt(`left:360px;top:${Y + 16}px;width:1152px;height:40px`, FORM) + `<div class="abs" style="right:16px;top:${Y + 16}px"><div class="float">${camTools}</div></div>` +
  note(`right:16px;bottom:16px`, "A · Workspaces", "Style"), 'data-draw="thumbnail 216 × 120"')

S["A-animate"] = page("A-animate", topbar("", seg(["Draw", "Style", "Animate"], "Animate", "ws lg")) +
  stage(0, Y, 1512, 560, "", 80) +
  floatAt(`left:16px;top:${Y + 16}px`, FORM) + `<div class="abs" style="right:16px;top:${Y + 16}px"><div class="float">${camTools}</div></div>` +
  at(0, 604, 1512, 378, "tl divt", `<div class="tlh"><span class="tabs2"><span>Timing</span><span class="on">Keys</span><span>Draw-in</span></span><span class="grow"></span>${TIMING_RIGHT}${sep}${CAMERA}${btn(ic("max"), "icon q")}</div>${transport()}${track({ w: 1512, lc: 176, rows: [{ k: "ruler", h: 24 }, { k: "strokes", h: 36 }, ...lanes(32)] })}`).replace('class="abs tl divt"', 'class="abs tl divt" data-m="tl"') +
  note(`left:16px;bottom:${982 - 604 + 16}px`, "A · Workspaces", "Animate"))

// B: panels on a grey workspace, 6 px gutters, a rail of show/hide icons.
const BX = 54, BY = 50, BW = 1452, BB = 976
const drawHead = `<span class="row gap4" style="margin-left:6px">${drawTools()}</span>`.replaceAll('class="btn', 'style="height:22px" class="btn')
const stageHead = `<span style="margin-left:6px">${seg(["Rod", "Extrude", "Solid", "Inflate"], "Rod", "sm")}</span>`
const stageHeadR = `${btn("Top", "q")}${btn("Reset camera", "q")}`.replaceAll('class="btn', 'style="height:22px" class="btn')
const bTop = (arr) => topbar(btn(`<span class="muted" style="font-weight:400">Layout</span> ${arr}${ic("down")}`, "line"))
const bStage = (x, y, w, h, imgH) => panel(x, y, w, h, "3D view", stageHead + `<span class="grow"></span>` + stageHeadR, bodyFill(`<div class="stage" style="position:absolute;inset:0"><img src="../img/obj3d.png" style="height:${imgH}%"></div>`))
{
  const topH = BB - BY - 328 - 6, dw = (BW - 6) / 2
  S["B-default"] = page("B-default", bTop("Default") + at(0, Y, 1512, H, "ws") + rail(["Drawing", "3D view", "Timeline"]) +
    panel(BX, BY, dw, topH, "Drawing", drawHead, bodyFill(`<div class="draw" style="position:absolute;inset:0">${LOGO("80%")}</div>`), { m: "draw" }).replace('data-m="draw"', 'data-m="draw" data-hdr="28"') +
    bStage(BX + dw + 6, BY, dw, topH, 70) +
    panel(BX, BY + topH + 6, BW, 328, "", `<span class="tabs"><span>Timing</span><span class="on">Keys</span><span>Draw-in</span></span>`, transport() + track({ w: BW, lc: 176, rows: [{ k: "ruler", h: 22 }, ...lanes(32)] }), { m: "tl" }).replace('data-m="tl"', 'data-m="tl" data-hdr="28"') +
    note(`left:${BX + 14}px;bottom:${982 - (BY + topH) + 14}px`, "B · Dockable panels", "Default"))
}
{
  const dockH = 460, topH = BB - BY - dockH - 6, dinW = 440, tw = BW - dinW - 6
  S["B-animating"] = page("B-animating", bTop("Animating") + at(0, Y, 1512, H, "ws") + rail(["3D view", "Timeline", "Draw-in"]) +
    bStage(BX, BY, BW, topH, 78) +
    panel(BX, BY + topH + 6, tw, dockH, "Timeline", `<span class="grow"></span>${CAMERA.replace('class="btn', 'style="height:22px" class="btn')}`, transport(TIMING_RIGHT) + track({ w: tw, lc: 120, rows: [{ k: "ruler", h: 22 }, { k: "strokes", h: 36 }, ...lanes(36)] }), { m: "tl" }).replace('data-m="tl"', 'data-m="tl" data-hdr="28"') +
    panel(BX + tw + 6, BY + topH + 6, dinW, dockH, "Draw-in", `<span class="tgl on" style="margin-left:4px"><i></i></span>`, drawIn()) +
    note(`left:${BX + 14}px;bottom:${982 - (BY + topH) + 14}px`, "B · Dockable panels", "Animating"))
}
{
  const menu = `<div class="menu"><h6>Arrangements</h6><div class="mi"><span class="dot"></span>Default</div><div class="mi"><span class="dot"></span>Animating</div><div class="mi hl"><span class="dot"><i></i></span>Drawing</div>
  <hr><h6>Show panels</h6>${[["Drawing", 1], ["3D view", 0], ["Timeline", 1, "collapsed"], ["Draw-in", 0], ["Style", 0], ["Export", 0]].map(([n, on, k]) => `<div class="mi"><span class="ck ${on ? "on" : ""}"></span>${n}${k ? `<span class="k">${k}</span>` : ""}</div>`).join("")}
  <hr><div class="mi">Save arrangement</div><div class="mi">Reset layout</div></div>`
  const dh = BB - BY - 28 - 6
  S["B-drawing"] = page("B-drawing", bTop("Drawing") + at(0, Y, 1512, H, "ws") + rail(["Drawing", "Timeline"], true) +
    panel(BX, BY, BW, dh, "Drawing", drawHead, bodyFill(`<div class="draw" style="position:absolute;inset:0">${LOGO("64%")}</div>`), { m: "draw", maxed: true }).replace('data-m="draw"', 'data-m="draw" data-hdr="28"') +
    at(BX, BB - 28, BW, 28, "panel", `<div class="ph" style="box-shadow:none"><span class="grip"></span><span class="t">Timeline</span><span class="play" style="width:20px;height:20px;margin-left:6px">${PLAY}</span>${tc}<span class="grow"></span><span class="hb">${ic("max")}</span></div>`) +
    `<div class="abs" style="left:56px;bottom:14px;z-index:10">${menu}</div>` +
    note(`right:${1512 - BX - BW + 14}px;bottom:${982 - (BY + dh) + 14}px`, "B · Dockable panels", "Drawing"), 'data-tl="collapsed to its 28 px header"')
}
// C: stage (drawing + 3D) over a dock, inspector on the right.
const inspector = at(1212, Y, 300, H, "", `<div class="ph2" style="gap:2px;padding:0 10px"><span class="tabs2"><span class="on">Style</span><span>Draw-in</span><span>Export</span></span></div>${families()}`, "box-shadow:inset 1px 0 0 var(--hair)")
S["C-default"] = page("C-default", topbar("") + drawing(0, Y, 606, 658).replace('class="abs draw"', 'class="abs draw" data-m="draw"') +
  stage(606, Y, 606, 658, "divl", 64) +
  floatAt(`left:622px;top:${Y + 16}px`, seg(["Rod", "Extrude", "Solid", "Inflate"], "Rod")) + `<div class="abs" style="left:${1212 - 16}px;top:${Y + 16}px;transform:translateX(-100%)"><div class="float">${camTools}</div></div>` +
  at(0, 702, 1212, 280, "tl divt", `<div class="tlh" style="height:40px"><span class="tabs2"><span>Timing</span><span class="on">Keys</span></span>${sep}${transport("", "in").replace(`${sep}<span class="tgl on"><i></i>Draw-in</span>${MORE}`, "")}<span class="grow"></span>${CAMERA}${btn(ic("more"), "icon q")}${btn(ic("max"), "icon q")}</div>${track({ w: 1212, lc: 150, rows: [{ k: "ruler", h: 16 }, ...lanes(32)] })}`).replace('class="abs tl divt"', 'class="abs tl divt" data-m="tl"') +
  inspector + note(`left:622px;bottom:${982 - 702 + 14}px`, "C · Stage plus inspector", "Default"))

S["C-dock-max"] = page("C-dock-max", topbar("") +
  at(0, Y, 1512, H, "tl", `<div class="tlh" style="height:44px;box-shadow:inset 0 -1px 0 var(--hair)"><span style="font-weight:600;font-size:13px;margin-right:4px">Timeline</span>${sep}${transport("", "in")}<span class="grow"></span>${TIMING_RIGHT}${sep}${CAMERA}${btn(ic("restore"), "icon q")}</div>${track({ w: 1512, lc: 176, hits: true, rows: [{ k: "ruler", h: 24 }, { k: "sec", label: "Strokes · 12, drag a bar to move it, drag an end to retime it" }, ...BARS.map((_, i) => ({ k: "strip", i, h: 22 })), { k: "sec", label: "Keys" }, ...lanes(36), { k: "sec", label: "Turn curve" }, { k: "curve", h: 262 }] })}`).replace('class="abs tl"', 'class="abs tl" data-m="tl"') +
  `<div class="abs thumb" style="right:16px;bottom:16px;width:360px;height:216px;border-radius:12px;background:var(--stage)"><img src="../img/obj3d.png" style="width:auto;height:88%"><span class="cap">3D preview · drag to move</span></div>` +
  `<span class="note-tag" style="left:${176 + 10 + (4.2 / TOTAL) * (1512 - 176 - 12 - 20) + 22}px;top:${44 + 44 + 24 + 26 + 12 * 22 + 26 + 36 * 2 + 10}px">32 × 36 click area</span>` +
  note(`left:16px;bottom:16px`, "C · Stage plus inspector", "Dock maximized"))

for (const [id, html] of Object.entries(S)) writeFileSync(HERE + `html/${id}.html`, html)

// ── Render ────────────────────────────────────────────────────────────────
const ROWS = [["A · Workspaces", "Draw, Style and Animate each take the whole window.", ["A-draw", "A-style", "A-animate"]], ["B · Dockable panels", "Panels you move, maximize, show and hide. Save an arrangement.", ["B-default", "B-animating", "B-drawing"]], ["C · Stage plus inspector", "Drawing and 3D side by side, dock below, settings on the right.", ["C-default", "C-dock-max"]]]
const NAMES = { "A-draw": "Draw", "A-style": "Style", "A-animate": "Animate", "B-default": "Default", "B-animating": "Animating", "B-drawing": "Drawing", "C-default": "Default", "C-dock-max": "Dock maximized" }
const sheet = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=block" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{font-family:Geist,sans-serif;background:#f4f4f4;color:#171717;padding:36px 40px;width:1720px;-webkit-font-smoothing:antialiased}
h1{font-size:20px;font-weight:600}p.sub{color:#737373;font-size:13px;margin:6px 0 28px}.r{display:grid;grid-template-columns:200px repeat(3,480px);gap:20px;margin-bottom:30px}
.r h2{font-size:15px;font-weight:600;margin-top:4px}.r p{font-size:12px;color:#737373;margin-top:6px;line-height:1.5}figure img{width:480px;height:312px;display:block;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 6px 18px -8px rgba(0,0,0,.18)}
figcaption{font-size:12px;font-weight:500;margin-top:8px}</style></head><body><h1>Free Stroke layout, three directions at 1512 × 982</h1>
<p class="sub">Drawing and 3D view are the real app captures. Keys on the lanes are examples; the app has none set. Key rows are 32 px or taller, keys 12 px, stroke bar ends 24 px. No winner picked.</p>
${ROWS.map(([h, p, ids]) => `<div class="r"><div><h2>${h}</h2><p>${p}</p></div>${ids.map((id) => `<figure><img src="png/${id}.png"><figcaption>${NAMES[id]}</figcaption></figure>`).join("")}</div>`).join("")}</body></html>`
writeFileSync(HERE + "sheet.html", sheet)

const { chromium, childPidsOf, isAlive } = await import(ROOT + "scripts/verify/lib/browser.mjs")
const before = new Set(childPidsOf(process.pid))
const browser = await chromium.launch({ label: "layout-mockups-2-render", args: ["--remote-debugging-port=9462"] })
const pids = childPidsOf(process.pid).filter((p) => !before.has(p))
try {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 })
  const pg = await ctx.newPage()
  const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(S)
  for (const id of only) {
    await pg.goto("file://" + HERE + `html/${id}.html`, { waitUntil: "networkidle" })
    await pg.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 20000 })
    await pg.waitForTimeout(150)
    const sizes = await pg.evaluate(() => document.querySelector("[data-sizes]").innerText.replace(/\n/g, " · "))
    const issues = await pg.evaluate(() => {
      const bad = [...document.querySelectorAll(".btn,.seg,.tr,.tlh,.ph,.f,.fr,.sw,.float,.menu,.lname,.select,.chip,.pill")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ":" + e.textContent.trim().slice(0, 20))
      const n = document.querySelector(".note").getBoundingClientRect()
      const hit = [...document.querySelectorAll(".btn,.seg,.key,.bar,.lname .n,.sw,.fr,svg.logo,.stage img,.float,.menu,.thumb")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !(r.right < n.left || r.left > n.right || r.bottom < n.top || r.top > n.bottom) }).map((e) => e.className.baseVal ?? e.className)
      return { overflow: bad, underLabel: hit }
    })
    const over = await pg.evaluate(() => [...document.querySelectorAll(".bar .e")].filter((e) => e.getBoundingClientRect().width < 23.5).length)
    await pg.screenshot({ path: HERE + `png/${id}.png`, clip: { x: 0, y: 0, width: 1512, height: 982 } })
    console.log(id, "|", sizes, "| bar ends under 24 px:", over, "|", JSON.stringify(issues))
  }
  await pg.setViewportSize({ width: 1720, height: 1200 })
  await pg.goto("file://" + HERE + "sheet.html", { waitUntil: "networkidle" })
  await pg.evaluate(() => document.fonts.ready)
  await pg.screenshot({ path: HERE + "sheet.png", fullPage: true })
} finally {
  await browser.close()
  for (const p of pids) if (isAlive(p)) { try { process.kill(p, "SIGKILL") } catch {} }
  console.log("browser pids", pids.join(","), "alive after close:", pids.filter(isAlive).join(",") || "none")
}
