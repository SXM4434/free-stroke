// The Export dock keeps its action bar visible while settings scroll inside
// the available panel height. The two viewport sizes are the panel check sizes.
import { chromium } from './lib/browser.mjs'
import { LAB_URL } from './lib/dev-server.mjs'
import { openDock } from './lib/dock.mjs'

let pass = 0
let fail = 0
function row(ok, name, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  ok ? pass++ : fail++
}

const browser = await chromium.launch()
try {
  for (const [width, height] of [[1512, 982], [1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
    try {
      const page = await context.newPage()
      await page.goto(LAB_URL, { waitUntil: 'domcontentloaded', timeout: 240000 })
      await openDock(page, { tab: 'export' })
      const videoButton = page.getByRole('button', { name: 'Video export settings' })
      await videoButton.click()
      const video = page.locator('[data-export-settings="video"]')
      await video.waitFor()

      const measure = () => page.evaluate(() => {
        const panel = document.querySelector('[data-dock-panel="export"]')
        const bar = document.querySelector('[data-export-panel] > div')
        const card = document.querySelector('[data-export-settings="video"], [data-export-settings="png"]')
        const end = card?.lastElementChild
        const p = panel?.getBoundingClientRect(), b = bar?.getBoundingClientRect()
        const c = card?.getBoundingClientRect(), e = end?.getBoundingClientRect()
        const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        return {
          panel: p && [p.top, p.bottom], bar: b && [b.top, b.bottom],
          card: c && [c.top, c.bottom], end: e && [e.top, e.bottom],
          panelScroll: panel?.scrollTop, cardScroll: card?.scrollTop,
          cardScrollable: card && card.scrollHeight > card.clientHeight + 1,
          barHit: !!hit && bar.contains(hit), viewportBottom: innerHeight,
        }
      })
      const inside = (m) => !!m.panel && !!m.card && m.card[0] >= m.panel[0] && m.card[1] <= Math.min(m.panel[1], m.viewportBottom) + 1
      const label = `${width}x${height}`
      let m = await measure()
      row(inside(m), `${label} Video card stays in dock`, JSON.stringify(m))
      row(m.barHit && m.panelScroll === 0, `${label} export bar stays visible`)
      row(m.cardScrollable, `${label} Video content has its own scroll`)

      await video.evaluate((el) => { el.scrollTop = el.scrollHeight })
      m = await measure()
      row(m.cardScroll > 0 && m.panelScroll === 0 && m.end[1] <= m.card[1] && m.end[0] >= m.card[0], `${label} bottom note is reachable inside card`, JSON.stringify(m))

      await video.getByRole('button', { name: 'Fixed' }).click()
      await video.getByRole('button', { name: 'Transparent' }).click()
      await video.evaluate((el) => { el.scrollTop = el.scrollHeight })
      m = await measure()
      row(inside(m) && m.cardScroll > 0 && m.end[1] <= m.card[1], `${label} expanded Video settings stay reachable`, JSON.stringify(m))

      await videoButton.click()
      await page.getByRole('button', { name: 'PNG export settings' }).click()
      const png = page.locator('[data-export-settings="png"]')
      await png.evaluate((el) => { el.scrollTop = el.scrollHeight })
      m = await measure()
      row(inside(m) && m.barHit && m.end[1] <= m.card[1], `${label} PNG settings stay in dock`, JSON.stringify(m))

      // Known bad: restore the old unbounded flow on this page. The same
      // containment check must turn red, or this gate cannot see the defect.
      await page.getByRole('button', { name: 'Video export settings' }).click()
      await video.waitFor()
      const control = await page.evaluate(() => {
        const panel = document.querySelector('[data-dock-panel="export"]')
        const host = panel?.querySelector('[data-dock-host="export"]')
        const root = panel?.querySelector('[data-export-panel]')
        const card = panel?.querySelector('[data-export-settings="video"]')
        panel.style.overflow = 'auto'
        host.style.height = 'auto'
        root.style.height = 'auto'
        card.style.flex = 'none'
        card.style.overflow = 'visible'
        const p = panel.getBoundingClientRect(), c = card.getBoundingClientRect()
        return c.bottom > Math.min(p.bottom, innerHeight) + 1
      })
      row(control, `${label} old unbounded flow fails containment`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
console.log(`${pass} PASS  ${fail} FAIL`)
process.exit(fail ? 1 : 0)
