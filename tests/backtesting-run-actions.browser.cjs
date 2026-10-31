// Uses served PWA assets and mocked API; never changes real runs.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    let rows = Array.from({ length: 25 }, (_, i) => ({ id: `run-${i}`, kind: 'simulation', status: 'completed', done: true, request_snapshot: { configuration: { label: `Backtest ${i}`, strategy: 'generic.BuyAndHold' } } }))
    rows.push({ id: 'benchmark', kind: 'market_data_refresh', done: true, status: 'completed', request_snapshot: { configuration: { label: 'Benchmark update' } } })
    let removed = null
    await page.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname
      const method = route.request().method()
      let data = []
      if (endpoint.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: ['none'], ticker_lists: [], profiles: [] }
      else if (endpoint.endsWith('/strategy')) data = { parameters: [] }
      else if (endpoint.endsWith('/jobs')) data = rows
      else if (method === 'PATCH') {
        const row = rows.find(row => endpoint.endsWith('/' + row.id))
        row.archive = { ...row.archive, ...route.request().postDataJSON() }
        data = row
      } else if (method === 'DELETE') {
        removed = endpoint.split('/').pop()
        rows = rows.filter(row => row.id !== removed)
        data = { deleted: true }
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/cdn.jsdelivr.net/**', route => route.abort())
    await page.goto('https://127.0.0.1:1443/dash/#/ExecuteStrategy', { waitUntil: 'domcontentloaded' })
    const tabs = page.getByRole('tablist')
    await page.getByLabel('Slippage (frazione)', { exact: true }).fill('0.001')
    let box = await tabs.boundingBox()
    assert.ok(box.y >= 50 && box.y < 240, `Tabs remain visible while filling form: ${box.y}`)
    await page.getByRole('tab', { name: 'Risultati e archivio' }).click()
    await page.getByRole('cell', { name: 'Backtest 0', exact: false }).first().waitFor()
    assert.equal(await page.getByText('Benchmark update', { exact: true }).count(), 0)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    box = await tabs.boundingBox()
    assert.ok(box.y >= 50 && box.y < 240, `Tabs remain visible in list: ${box.y}`)
    const firstRow = page.getByRole('row').filter({ hasText: 'Backtest 0' })
    await firstRow.getByRole('button', { name: 'Archivia', exact: true }).click()
    await firstRow.waitFor({ state: 'hidden' })
    await page.getByLabel('Mostra archiviati', { exact: true }).check()
    await firstRow.getByRole('button', { name: 'Ripristina', exact: true }).waitFor()
    await firstRow.getByRole('button', { name: 'Cancella', exact: true }).click()
    await page.getByRole('button', { name: 'Annulla', exact: true }).click()
    assert.equal(removed, null)
    await firstRow.getByRole('button', { name: 'Cancella', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancella', exact: true }).click()
    await firstRow.waitFor({ state: 'hidden' })
    assert.equal(removed, 'run-0')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Nuovo run', exact: true }).click()
    await page.getByLabel('Slippage (frazione)', { exact: true }).fill('0.002')
    box = await tabs.boundingBox()
    assert.ok(box.y >= 50 && box.y < 350, `Mobile navigation remains visible: ${box.y}`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: '/tmp/backtesting-run-actions.png' })
    console.log('Sticky tabs, simulation-only list, archive/restore and confirmed deletion verified')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
