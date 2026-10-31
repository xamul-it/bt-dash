// Run after the PWA build. All API calls are mocked; no backtest or writes occur.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1200 } })
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    let requests = 0
    const saved = { name: 'saved_new', label: 'development', source_type: 'run', available: true }
    await page.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname
      let data = []
      if (endpoint.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: ['none'], ticker_lists: [], profiles: [] }
      else if (endpoint.endsWith('/strategy')) data = { parameters: [] }
      else if (endpoint.endsWith('/benchmarks')) { requests++; data = [saved, { name: 'hidden', label: 'Hidden', hidden: true }, { name: 'missing', label: 'Missing', available: false }] }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/cdn.jsdelivr.net/**', route => route.abort())
    await page.goto(process.env.BT_BROWSER_BASE || 'https://127.0.0.1:1443/dash/#/ExecuteStrategy', { waitUntil: 'domcontentloaded' })
    const combo = page.getByLabel('Benchmark', { exact: true })
    const ticker = page.getByLabel('Universo ticker', { exact: true })
    assert.equal(await combo.isVisible(), true)
    const initialTicker = await ticker.inputValue()
    const comboBox = await combo.boundingBox()
    const tickerBox = await ticker.boundingBox()
    assert.ok(Math.abs(comboBox.y - tickerBox.y) < 100, 'Benchmark must be beside the ticker field')
    await combo.click()
    const option = page.getByRole('option', { name: 'development', exact: true })
    await option.waitFor()
    assert.equal(await page.getByRole('option', { name: 'Hidden', exact: true }).count(), 0)
    assert.equal(await page.getByRole('option', { name: 'Missing', exact: true }).count(), 0)
    await option.click()
    assert.match(await combo.locator('..').innerText(), /development/)
    assert.equal(await ticker.inputValue(), initialTicker)
    assert.equal(requests, 1)
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/benchmarks')),
      combo.click(),
    ])
    await option.waitFor()
    assert.equal(requests, 2)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: '/tmp/benchmark-selection.png' })
    console.log('Benchmark combo: newly saved run refreshed and selected; hidden/unavailable excluded')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
