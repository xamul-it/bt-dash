// Served PWA with read-only audit fixtures; no operational API requests.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const fixtures = JSON.parse(fs.readFileSync(process.env.CRON_REFERENCE_FIXTURES, 'utf8'))
  const ids = Object.keys(fixtures).map(Number).sort((a, b) => b - a)
  const first = fixtures[ids[0]]
  const requests = []
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1500, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      let data = []
      if (url.pathname.endsWith('/auth/status')) data = { authed: true }
      else if (url.pathname.endsWith('/cron/profiles')) data = [{ profile: first.profile, strategy: first.baselines[0].strategy }]
      else if (url.pathname.endsWith('/overview')) {
        const id = Number(url.searchParams.get('baseline_id') || ids[0])
        requests.push(id)
        data = fixtures[id]
        assert.ok(data, 'Requested baseline belongs to this profile')
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(`${process.env.DASH_PREVIEW_URL || 'https://127.0.0.1:1443'}/dash/#/Watchtower/CronMonitoring`)
    await page.locator('.baseline-comparison').nth(1).waitFor()
    for (const [index, source] of ['backtest', 'alpaca'].entries()) {
      const table = page.locator('.baseline-comparison').nth(index)
      for (const [n, window] of Object.entries(first.reconciliation_statistics[source])) {
        const balance = window.recent.balance_persistence
        if (balance.status === 'available') {
          assert.equal(balance.window_days, Number(n))
          await table.getByText(`Sotto media ${balance.recent.below_mean_days} / ${n}`, { exact: true }).waitFor()
        }
      }
      for (const label of ['Coerenza storica della serie', 'Bilanciamento dei rendimenti', 'Persistenza dei rendimenti']) {
        const row = table.locator('tbody tr').filter({ hasText: label })
        assert.equal(await row.locator('.historical-coherence').count(), 6)
        const unavailable = Object.values(first.reconciliation_statistics[source]).filter(w =>
          w.recent.historical_coherence.status === 'unavailable').length
        assert.equal(await row.getByText('Non valutabile', { exact: true }).count(), unavailable)
      }
    }
    const warned = page.locator('.baseline-comparison').first().getByLabel('Giornate escluse dal calcolo', { exact: true })
    const expectedWarnings = Object.values(first.reconciliation_statistics.backtest).filter(w => w.recent.excluded_days?.length).length
    assert.equal(await warned.count(), expectedWarnings)
    if (expectedWarnings) {
      await warned.first().hover()
      await page.getByRole('tooltip').filter({ hasText: 'giornate valide' }).waitFor()
      await page.mouse.move(0, 0)
    }
    const reference = first.reconciliation_statistics.backtest['3'].recent.historical_coherence
    await page.locator('.baseline-comparison').first().getByText(`${reference.tail_blocks} / ${reference.historical_blocks} periodi`, { exact: true }).first().waitFor()
    if (ids.length > 1) {
      await page.locator('.q-select').filter({ hasText: 'Baseline' }).click()
      const selected = first.baselines.find(b => b.id === ids[1])
      await Promise.all([
        page.waitForResponse(response => response.url().includes(`baseline_id=${ids[1]}`)),
        page.getByRole('option').filter({ hasText: selected.label }).click(),
      ])
      assert.equal(requests.at(-1), ids[1])
    }
    await page.screenshot({ path: '/tmp/cron-reference-fixed.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Three shared indicator rows, real sample coverage, historical periods and baseline selection verified on served PWA with audit fixtures.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
