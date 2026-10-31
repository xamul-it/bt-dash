// Served PWA, mocked data: no downloads or real backtest mutations.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const bars = Array.from({ length: 30 }, (_, i) => ({ Date: `2026-09-${String(i + 1).padStart(2, '0')}`, Open: 100 + i, High: 104 + i, Low: 98 + i, Close: 102 + i, Volume: 1000 + i }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      let data = []
      if (path.endsWith('/catalog')) data = { strategies: [{ label: 'OvernightAH', value: 'overnight_ah.OvernightAH' }], benchmarks: [], ticker_lists: [], profiles: [] }
      else if (path.endsWith('/strategy')) data = { parameters: [{ name: 'period', default: 10, type: 'int' }], parameter_groups: [
        { class_name: 'Child', description: 'period : int\n    Child help.', parameters: [{ name: 'period', default: 10, type: 'int' }] },
        { class_name: 'Parent', description: 'period : int\n    Parent help.', parameters: [{ name: 'period', default: 5, type: 'int' }] },
      ] }
      else if (path.endsWith('/jobs')) data = [{ id: 'responsive', kind: 'simulation', status: 'completed', done: true, created_at: '2026-10-19T12:34:56Z', request_snapshot: { configuration: { label: 'Backtest responsive', strategy: 'overnight_ah.OvernightAH', fromdate: '2026-01-01', todate: '2026-10-01' } } }]
      else if (path.endsWith('/bars')) data = bars
      else if (path.endsWith('/data')) data = [{ symbol: 'NVDA', available: true, format: 'csv' }]
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/cdn.jsdelivr.net/**', route => route.abort())
    const base = 'https://127.0.0.1:1443/dash/'
    await page.goto(base + '#/Configure')
    await page.getByRole('button', { name: 'Barre e grafico' }).click()
    await page.locator('.financial-chart canvas').first().waitFor()
    await page.waitForTimeout(500)
    assert.match(await page.locator('.financial-chart__legend').innerText(), /O 1[0-9]+,00/)
    assert.ok(await page.locator('.financial-chart canvas').first().evaluate(canvas => canvas.width > 500 && canvas.height > 100))
    await page.screenshot({ path: '/tmp/ticker-chart-fixed.png' })
    await page.getByRole('dialog').getByRole('button').last().click()
    await page.goto(base + '#/ExecuteStrategy')
    await page.getByText('Child', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('period', { exact: true }).count(), 2)
    const parent = page.locator('section').filter({ hasText: 'Parent' })
    await parent.getByLabel('period', { exact: true }).fill('17')
    assert.equal(await page.getByLabel('period', { exact: true }).first().inputValue(), '17')
    await page.getByRole('tab', { name: 'Risultati e archivio' }).click()
    for (const width of [1440, 900, 600, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const row = width < 600 ? page.locator('.studio-run-card').filter({ hasText: 'Backtest responsive' }) : page.getByRole('row').filter({ hasText: 'Backtest responsive' })
      for (const name of ['Apri', 'Duplica configurazione', 'Aggiungi ai preferiti', 'Archivia', 'Cancella']) {
        const button = row.getByRole('button', { name, exact: true })
        const box = await button.boundingBox()
        assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${name} is in viewport at ${width}: ${JSON.stringify(box)}`)
        await button.click({ trial: true })
      }
    }
    await page.screenshot({ path: '/tmp/backtest-mobile-fixed.png' })
    assert.deepEqual(errors, [])
    console.log('Ticker candles, owner groups, shared overrides and actions at 1440/900/600/390px verified')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
