// Served PWA with mocked API: never creates or changes real runs.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block' })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    const rows = [1, 2].map(n => ({ id: `r${n}`, kind: 'simulation', done: true, status: 'completed', request_snapshot: { configuration: { label: `Run ${n}`, strategy: 'generic.BuyAndHold', parameters: { period: n }, broker: { cash: 1000 } } }, result: { artifacts: ['stats.html', 'trades.json'], benchmark: { source_name: 'bench-id' } } }))
    let offline = false
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (offline && path.endsWith('/jobs')) return route.abort('failed')
      let data = []
      if (path.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [{ name: 'bench-id', label: 'Benchmark leggibile' }], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: [], ticker_lists: [], profiles: [] }
      else if (path.endsWith('/strategy')) data = { parameters: [] }
      else if (path.endsWith('/jobs')) data = rows
      else if (/\/jobs\/r[12]$/.test(path)) data = rows.find(r => path.endsWith(r.id))
      else if (path.endsWith('/trades')) data = { rows: Array.from({ length: 50 }, (_, i) => ({ ticker: 'AAPL', pnl: 10, entry_date: '2026-01-01', exit_date: '2026-02-01', duration_bars: 30, quantity: 100, entry_price: 100, exit_price: 110, pnl_pct: 10 })), total: 1 }
      else if (path.endsWith('stats.html')) return route.fulfill({ contentType: 'text/html', body: '<h1>Report di prova</h1>' })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/ExecuteStrategy')
    assert.equal(await page.getByRole('tab', { name: 'Nuova simulazione' }).count(), 0)
    assert.equal(await page.getByRole('switch', { name: 'Mostra parametri unused', exact: true }).isChecked(), false)
    await page.getByRole('tab', { name: 'Risultati e archivio' }).click()
    const compare = page.getByRole('button', { name: 'Confronta parametri', exact: true })
    assert.equal(await compare.isDisabled(), true)
    await page.getByRole('checkbox', { name: 'Seleziona Run 1 per confronto', exact: true }).check()
    assert.equal(await compare.isDisabled(), true)
    await page.getByRole('checkbox', { name: 'Seleziona Run 2 per confronto', exact: true }).check()
    await compare.click()
    await page.getByText('parameters.period', { exact: true }).waitFor()
    assert.equal(await page.locator('.comparison-table tbody tr').count(), 1)
    await page.getByRole('button', { name: 'Chiudi confronto' }).click()
    await page.getByRole('row').filter({ hasText: 'Run 1' }).getByRole('button', { name: 'Apri', exact: true }).click()
    await page.getByRole('button', { name: 'Benchmark leggibile', exact: true }).waitFor()
    await page.getByRole('button', { name: 'stats.html', exact: true }).first().click()
    await page.frameLocator('iframe[title="Report statistiche"]').getByText('Report di prova').waitFor()
    await page.getByRole('button', { name: 'Chiudi report' }).click()
    await page.getByRole('tab', { name: 'Parametri run' }).click()
    await page.getByText('Parametri strategia · override richiesti', { exact: true }).waitFor()
    await page.getByRole('tab', { name: 'Trade', exact: true }).click()
    await page.locator('.trade-table tbody tr').first().waitFor()
    const table = await page.locator('.trade-table .q-table__middle').evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight }))
    assert.ok(table.scroll > table.height, 'Rows scroll inside a bounded table')
    assert.ok(table.bottom <= table.viewport, 'Horizontal scrollbar stays in viewport')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('AAPL', { exact: true }).first().waitFor()
    await page.screenshot({ path: '/tmp/watchtower-trades-mobile.png' })
    await page.getByRole('button', { name: 'Chiudi dettaglio run' }).click()
    offline = true
    await page.getByText('Network Error', { exact: true }).waitFor()
    offline = false
    await page.getByText('Network Error', { exact: true }).waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
    console.log('Comparison, structured parameters, benchmark label, stats lightbox, mobile trades and network recovery verified')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
