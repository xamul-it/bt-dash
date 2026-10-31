const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1500, height: 1300 } })
    const errors = [], queries = [], accounts = []
    page.on('pageerror', e => errors.push(e.message))
    const base = Date.parse('2026-10-28T13:00:00Z') / 1000
    const windows = [
      { id: 1, start_ns: (base - 86400) * 1e9, end_ns: (base - 85000) * 1e9, date: '2026-10-27', session: 'RTH', event_count: 50 },
      { id: 2, start_ns: base * 1e9, end_ns: (base + 1799) * 1e9, date: '2026-10-28', session: 'Pre-market', event_count: 1800 },
      { id: 3, start_ns: (base + 1800) * 1e9, end_ns: (base + 3600) * 1e9, date: '2026-10-28', session: 'RTH', event_count: 1800 },
    ]
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname
      let data = []
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/al/contexts')) data = [{ portfolio_key_id: 'paper', paper: true, display_name: 'Paper' }, { portfolio_key_id: 'live', paper: false, display_name: 'Live' }]
      else if (path.endsWith('/al/portfolio')) { accounts.push(url.searchParams.get('portfolio_key_id')); data = { positions: [] } }
      else if (path.endsWith('/al/activities')) data = { activities: [{ id: 'fill', symbol: 'AAPL', side: 'buy', price: 101, qty: 2, timestamp: new Date((base + 1805) * 1000).toISOString() }], cache: { mode: 'local' } }
      else if (path.endsWith('/quote-monitor/archives')) data = { rows: [{ symbol: 'AAPL', bytes: 10000, modified_at: base }] }
      else if (path.endsWith('/archives/AAPL/index')) data = { state: 'READY', windows }
      else if (path.endsWith('/archives/AAPL/chart')) {
        const mode = url.searchParams.get('mode'), from = Number(url.searchParams.get('from') || base), to = Number(url.searchParams.get('to') || base + 3600)
        queries.push({ mode, windows: url.searchParams.get('windows'), from, to })
        const rows = []
        for (let time = base; time <= base + 3600; time += mode === 'bars' ? 60 : 5) {
          if (time < from || time > to) continue
          rows.push({ time, timestamp: new Date(time * 1000).toISOString(), event_type: mode === 'bars' ? 'bar' : 'quote',
            open: 100, high: 103, low: 99, close: 101, volume: 500, bid_price: 100 + Math.sin(time), ask_price: 101 + Math.sin(time) })
        }
        await new Promise(resolve => setTimeout(resolve, 100))
        data = { rows, start: base, end: base + 3600, visible_events: rows.length, events: 3600, sampled: false }
      } else if (path.endsWith('/simulations/jobs')) data = [{ id: 'sim1', kind: 'simulation', status: 'completed', archive: { pinned: true }, request_snapshot: { configuration: { label: 'Run confronto', strategy: 'Strategia test' } } }, { id: 'sim2', kind: 'simulation', status: 'completed', archive: { label: 'Non preferito' } }]
      else if (path.endsWith('/jobs/sim1/trades')) data = { total: 1, rows: [{ asset: 'AAPL', entry_side: 'long', price: 100, size: 2, open_datetime: new Date((base+1800)*1000).toISOString(), close_datetime: new Date((base+1900)*1000).toISOString(), exit_price: 102 }] }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/Zmq/History?symbol=AAPL')
    const bars = page.getByRole('img', { name: 'Grafico barre native', exact: true })
    const ticks = page.getByRole('img', { name: 'Grafico finanziario bid ask e scambi', exact: true })
    await bars.waitFor(); await ticks.waitFor()
    await page.waitForFunction(() => document.querySelector('[data-range-to]'))
    assert.ok(queries.every(q => q.windows === '2,3'))
    assert.ok(queries.some(q => q.mode === 'bars') && queries.some(q => q.mode === 'ticks'))
    assert.ok(accounts.length && accounts.every(a => a === 'live'))
    await page.getByText('la cache o i limiti di caricamento', { exact: false }).waitFor()
    const bounds = await bars.boundingBox()
    await bars.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } })
    await page.waitForFunction(() => {
      const c = document.querySelector('[aria-label="Grafico barre native"]')
      return c && Number(c.dataset.rangeTo) - Number(c.dataset.rangeFrom) < 130
    })
    await page.waitForTimeout(1600)
    const range = await bars.evaluate(el => ({ from: Number(el.dataset.rangeFrom), to: Number(el.dataset.rangeTo) }))
    const tickRange = await ticks.evaluate(el => ({ from: Number(el.dataset.rangeFrom), to: Number(el.dataset.rangeTo) }))
    assert.ok(range.to - range.from < 130, 'Reload must preserve selected minute')
    assert.ok(Math.abs(tickRange.from - range.from) <= 60)
    assert.ok(queries.some(q => q.to - q.from === 60), 'Click fetches selected minute')
    await page.getByRole('button', { name: 'Tick', exact: true }).click()
    assert.equal(await bars.count(), 0)
    await page.getByRole('button', { name: 'Confronto', exact: true }).click()
    await bars.waitFor()
    assert.ok(await page.getByRole('link', { name: 'Apri grafico esterno' }).getAttribute('href').then(url => url.includes('AAPL')))
    await page.getByLabel('Run backtest da confrontare (facoltativo)').click()
    await page.getByRole('option').filter({ hasText: 'Run confronto' }).waitFor()
    assert.equal(await page.getByRole('option').filter({ hasText: 'Non preferito' }).count(), 0)
    assert.match(await page.getByRole('option').filter({ hasText: 'Run confronto' }).innerText(), /^Run confronto · Strategia test/)
    await page.getByRole('option').filter({ hasText: 'Run confronto' }).click()
    await page.getByText('Eseguiti e simulazioni nel periodo', { exact: true }).click()
    await page.getByRole('cell', { name: 'Backtest simulato', exact: true }).first().waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false)
    await page.screenshot({ path: '/tmp/recorded-market-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS native bars/ticks, last continuous windows, live account, selected minute preserved, synchronized ranges, simulation/fill markers and mobile')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
