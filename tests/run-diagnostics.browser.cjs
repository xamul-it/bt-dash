// Isolated PWA preview with API fixtures. Does not touch operational data.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', ignoreHTTPSErrors: true, hasTouch: true })
    if (process.env.DASH_PREVIEW_PASSWORD) {
      const response = await page.request.post(`${process.env.DASH_PREVIEW_URL}/api/auth/login`, {
        data: { password: process.env.DASH_PREVIEW_PASSWORD },
      })
      assert.equal(response.status(), 200)
    }
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const run = { id: 'diagnostic-run', kind: 'simulation', done: true, status: 'completed', request_snapshot: { configuration: { label: 'Run diagnostica', strategy: 'generic.BuyAndHold', timeframe: 'daily' } }, result: { artifacts: ['trades.json', 'returns.csv'] } }
    const metrics = { mean: 0.1, stddev: 1, win_rate: 0.6, average_daily_return_pct: 0.2 }
    const baseline = { metrics, sample_size: 100, window_start: '2020-01-01', window_end: '2020-03-31' }
    const trade = { key: 'trade', asset: 'AAA', size: 2, price: 100, open_datetime: '2020-03-30', close_datetime: '2020-03-31', pnl: 134368.661315917, pnl_pct: 1.8540144445780824 }
    const coherence = days => days === 15
      ? { status: 'unavailable', reason: 'Storico precedente insufficiente' }
      : { status: days === 3 ? 'very_few_precedents' : days === 5 ? 'few_precedents' : 'many_precedents',
        historical_blocks: 100, tail_blocks: days === 3 ? 0 : days === 5 ? 10 : 50,
        historical_start: '2010-01-01', historical_end: '2019-12-31' }
    const balance = days => days === 15
      ? { status: 'unavailable', reason: 'Storico precedente insufficiente' }
      : { status: 'available', window_days: days, threshold_mean: .00123,
        threshold_reference_start: '2000-01-01', reference_end: '2019-12-31', recent_end: '2020-03-31',
        historical_start: '2004-01-01', historical_end: '2019-12-31',
        baseline_fractions: { negative: .3, zero: .2, positive: .5, below_mean: .6 },
        recent: { negative_days: 1, zero_days: 1, positive_days: days - 2,
          below_mean_days: 2, longest_negative_run: 1, longest_below_mean_run: 2 },
        ongoing_negative_days: 0, ongoing_below_mean_days: 0,
        balance: { status: 'many_precedents', historical_blocks: 100, tail_blocks: 50 },
        persistence: { status: 'very_few_precedents', historical_blocks: 100, tail_blocks: 0 } }
    let diagnosticRequests = 0
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      let data = []
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: [], ticker_lists: [], profiles: [] }
      else if (path.endsWith('/strategy')) data = { parameters: [] }
      else if (path.endsWith('/jobs')) data = [run]
      else if (path.endsWith('/jobs/diagnostic-run')) data = run
      else if (path.endsWith('/equity')) data = { points: [] }
      else if (path.endsWith('/diagnostics')) {
        diagnosticRequests++
        data = { baseline, windows: [3, 5, 10, 15, 20, 25].map(days => ({ days, comparison: { recent: { ...baseline, metrics: days === 3 ? { ...metrics, mean: -0.1, average_daily_return_pct: -0.2 } : metrics, sample_size: days, historical_coherence: coherence(days), balance_persistence: balance(days) } } })), total_days: 2, warnings: [], open_positions: [{ asset: 'OPEN', size: 1, price: 50, current: 51 }], rows: [{ key: '2020-03-31', trading_date: '2020-03-31', statusLabel: 'Backtest', badgeColor: 'primary', day_return: -0.2, detail: '0 aperture · 1 chiusure', opened: [], closed: [trade], holdings: [{ asset: 'OPEN', market_value: 51 }] }] }
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(`${process.env.DASH_PREVIEW_URL || 'http://127.0.0.1:18765'}/dash/#/ExecuteStrategy?run=diagnostic-run`)
    const title = page.getByText('Il periodo finale è compatibile con la storia del run?', { exact: true })
    await title.waitFor()
    const artifacts = await page.getByText('Artefatti disponibili', { exact: true }).boundingBox()
    const diagnostic = await title.boundingBox()
    assert.ok(diagnostic.y > artifacts.y)
    assert.equal(await page.locator('.baseline-comparison').count(), 1)
    const indicators = page.locator('.baseline-comparison tbody tr').filter({ hasText: 'Coerenza storica della serie' }).locator('.historical-coherence')
    assert.equal(await indicators.count(), 6)
    await indicators.nth(0).getByText('Molto pochi precedenti', { exact: true }).waitFor()
    await indicators.nth(0).getByText('0 / 100 periodi', { exact: true }).waitFor()
    await indicators.nth(1).getByText('Pochi precedenti', { exact: true }).waitFor()
    await indicators.nth(2).getByText('Molti precedenti', { exact: true }).waitFor()
    await indicators.nth(3).getByText('Non valutabile', { exact: true }).waitFor()
    const balanceRow = page.locator('.baseline-comparison tbody tr').filter({ hasText: 'Bilanciamento dei rendimenti' })
    const persistenceRow = page.locator('.baseline-comparison tbody tr').filter({ hasText: 'Persistenza dei rendimenti' })
    assert.equal(await balanceRow.locator('.balance-persistence').count(), 6)
    assert.equal(await persistenceRow.locator('.balance-persistence').count(), 6)
    await balanceRow.getByText('Negative 1', { exact: true }).first().waitFor()
    await balanceRow.getByText('Media storica +0,123%', { exact: true }).first().waitFor()
    await persistenceRow.getByText('0 / 100 periodi', { exact: true }).first().waitFor()
    await persistenceRow.getByText('Massimo di perdite consecutive: 1', { exact: true }).first().waitFor()
    await balanceRow.getByText('Non valutabile', { exact: true }).waitFor()
    await persistenceRow.getByText('Massimo di giorni consecutivi sotto media: 2', { exact: true }).first().waitFor()
    assert.equal(await persistenceRow.getByText(/In corso:/).count(), 0)
    assert.equal(await page.locator('.ongoing-sequences').count(), 1)
    await page.locator('.ongoing-sequences').getByText('Perdite consecutive: 0 sedute', { exact: true }).waitFor()
    await page.locator('.ongoing-sequences').getByText('Giorni consecutivi sotto media: 0 sedute', { exact: true }).waitFor()
    for (const [label, formula] of [
      ['Compatibilità statistica della media dei trade', 'p = 2 × [1 − Φ(z)]'],
      ['Coerenza storica della serie', 'ℓₜ = ln(1 + rₜ)'],
      ['Bilanciamento dei rendimenti', 'C_sotto = Σ 1(rₜ < μ); 1(condizione) vale 1 se vera, altrimenti 0'],
      ['Persistenza dei rendimenti', 'Lₜ = bₜ × (Lₜ₋₁ + 1), con L₀ = 0 all’inizio della finestra'],
      ['Sequenze ancora aperte all’ultima seduta', 'Soglia delle perdite: 0; soglia sotto media: μ'],
    ]) {
      const help = page.getByRole('button', { name: `Informazioni su ${label}`, exact: true })
      await help.focus()
      const tooltip = page.locator('.statistical-help-tooltip')
      await tooltip.getByText(formula, { exact: true }).waitFor()
      await help.press('Escape')
      await tooltip.waitFor({ state: 'hidden' })
    }
    const dailyRow = page.getByRole('row').filter({ hasText: '0 aperture · 1 chiusure' })
    assert.equal(await dailyRow.locator('.text-negative').count(), 1)
    assert.equal(await page.locator('.baseline-comparison tbody tr').filter({ hasText: 'Gain medio/trade' }).locator('td.text-positive').count(), 6)
    assert.equal(await page.locator('.baseline-comparison tbody tr').filter({ hasText: 'Gain medio/trade' }).locator('td.text-negative').count(), 1)
    await dailyRow.click()
    await page.getByText('Posizioni a fine giornata', { exact: true }).waitFor()
    await page.getByText('OPEN · controvalore 51,00', { exact: true }).waitFor()
    await page.getByText(/AAA · direzione n\/d/).waitFor()
    await page.getByText(/PnL 134\.368,66/).waitFor()
    await page.getByText('1,85%', { exact: true }).waitFor()
    assert.equal(diagnosticRequests, 1)
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileHelp = page.getByRole('button', { name: 'Informazioni su Persistenza dei rendimenti', exact: true })
    await mobileHelp.tap()
    const mobileTooltip = page.locator('.statistical-help-tooltip')
    await mobileTooltip.getByText('Persistenza dei rendimenti', { exact: true }).waitFor()
    await page.waitForFunction(() => {
      const element = document.querySelector('.statistical-help-tooltip')
      return element && Number(getComputedStyle(element).opacity) === 1
    })
    const tooltipBox = await mobileTooltip.boundingBox()
    assert.ok(tooltipBox.width > 300 && tooltipBox.width <= 390 && tooltipBox.x >= 0)
    assert.ok(await mobileTooltip.evaluate(element => {
      element.scrollTop = element.scrollHeight
      const scrolled = element.scrollTop > 0
      element.scrollTop = 0
      return scrolled
    }))
    await page.screenshot({ path: '/tmp/statistical-help-mobile.png' })
    await mobileTooltip.getByRole('button', { name: 'Chiudi informazioni statistiche' }).tap()
    await mobileTooltip.waitFor({ state: 'hidden' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: '/tmp/run-diagnostics-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.route('**/api/dyn/obs/watchtower/cron/**', route => {
      const path = new URL(route.request().url()).pathname
      let data = []
      if (path.endsWith('/profiles')) data = [{ profile: 'test-profile' }]
      if (path.endsWith('/overview')) data = {
        baselines: [{ ...baseline, id: 1, label: 'Baseline test' }],
        reconciliation_statistics: {
          backtest: Object.fromEntries([3,5,10,15,20,25].map(days => [String(days), { recent: baseline }])),
          alpaca: Object.fromEntries([3,5,10,15,20,25].map(days => [String(days), { recent: baseline }])),
        },
        entry_decisions: [{ source: 'backtest', trading_date: '2020-03-31', run_status: 'completed', orders: [{ symbol: 'AAA', side: 'buy', qty: 2 }] }],
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(`${process.env.DASH_PREVIEW_URL || 'http://127.0.0.1:18765'}/dash/#/Watchtower/CronMonitoring`)
    await page.getByText('La strategia performa come in passato?', { exact: true }).waitFor()
    await page.locator('.baseline-comparison').nth(1).waitFor()
    assert.equal(await page.locator('.baseline-comparison').count(), 2)
    assert.equal(await page.locator('.historical-coherence').getByText('Non valutabile', { exact: true }).count(), 36)
    assert.equal(await page.locator('.ongoing-sequences').count(), 2)
    assert.equal(await page.locator('.ongoing-sequences').getByText('Non valutabile: serie giornaliera o riferimento storico insufficiente.', { exact: true }).count(), 2)
    await page.getByRole('button', { name: 'Informazioni su Bilanciamento dei rendimenti', exact: true }).first().click()
    await page.locator('.statistical-help-tooltip').getByText('Bilanciamento dei rendimenti', { exact: true }).waitFor()
    await page.locator('.statistical-help-tooltip').getByRole('button', { name: 'Chiudi informazioni statistiche' }).click()
    await page.locator('#reconciliation-table tbody tr').first().click()
    await page.getByText('Decisioni di ingresso — 2020-03-31', { exact: true }).waitFor()
    await page.getByText(/BUY AAA/).waitFor()
    await page.screenshot({ path: '/tmp/cron-shared-diagnostics.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Run diagnostics rendered below artifacts; statistical windows, expandable trade details and daily holdings verified in PWA preview.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
