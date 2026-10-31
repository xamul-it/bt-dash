// Served PWA with real strategy schemas and mocked API; no jobs are submitted.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const schemas = JSON.parse(fs.readFileSync(process.env.STRATEGY_SCHEMAS || '/tmp/parameter-section-schemas.json'))
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block' })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    for (const [strategy, schema] of Object.entries(schemas)) {
      await page.unrouteAll()
      await page.route('**/api/**', route => {
        const endpoint = new URL(route.request().url()).pathname
        let data = []
        if (endpoint.endsWith('/catalog')) data = { strategies: [{ label: strategy.split('.').pop(), value: strategy }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: ['none'], ticker_lists: [], profiles: [] }
        else if (endpoint.endsWith('/strategy')) data = schema
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
      })
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto('https://127.0.0.1:1443/dash/#/ExecuteStrategy', { waitUntil: 'domcontentloaded' })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByLabel('Strategia', { exact: true }).click()
        await page.getByRole('option', { name: strategy.split('.').pop(), exact: true }).click()
        const search = page.getByLabel('Cerca parametro', { exact: true })
        await search.fill('hedge_')
        const hedge = page.locator('.studio-parameter-section').filter({ has: page.getByText('hedge', { exact: true }) })
        await hedge.getByLabel('enabled', { exact: true }).waitFor()
        assert.equal(await hedge.getByLabel('symbol', { exact: true }).count(), 1)
        await hedge.getByRole('button', { name: 'Informazioni su OvernightAH · hedge', exact: true }).click()
        const popup = page.locator('.q-menu .parameter-help, .q-dialog .parameter-help')
        await popup.waitFor()
        assert.match(await popup.innerText(), /prima|dopo/)
        assert.match(await popup.innerText(), /Risk_overlay/)
        await page.keyboard.press('Escape')
        await popup.waitFor({ state: 'hidden' })
        await search.fill('risk_overlay_')
        await page.getByRole('button', { name: 'Informazioni su OvernightAH · risk_overlay', exact: true }).click()
        await popup.waitFor()
        assert.match(await popup.innerText(), /paper\/live/)
        await page.keyboard.press('Escape')
        await popup.waitFor({ state: 'hidden' })
        await search.fill('monthly_universe_')
        if (strategy.includes('flat_composite')) {
          const composite = page.locator('section').filter({ has: page.getByText('OvernightAHFlatComposite', { exact: true }) })
          await composite.getByLabel('flat_weights', { exact: true }).waitFor()
          await composite.getByRole('button', { name: 'Informazioni su OvernightAHFlatComposite · monthly_universe', exact: true }).click()
          await popup.waitFor()
          assert.match(await popup.innerText(), /pannello esterno/)
          await page.keyboard.press('Escape')
        await popup.waitFor({ state: 'hidden' })
        }
        await page.mouse.move(0, 0)
        await page.locator('.q-dialog__backdrop').waitFor({ state: 'hidden' })
        await page.screenshot({ path: `/tmp/parameter-sections-${strategy.split('.')[1]}-${width}.png` })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right})).slice(-15))))
      }
    }
    assert.deepEqual(errors, [])
    console.log('Both strategies: sections, search, class ownership, help popups and mobile layout verified')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
