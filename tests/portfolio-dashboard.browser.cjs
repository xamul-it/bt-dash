// Served PWA with broker fixtures. No orders or operational writes.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } })
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname
      requests.push({ path, context: url.searchParams.get('portfolio_key_id'), tf: url.searchParams.get('timeframe') })
      let data = []
      const mirror = url.searchParams.get('portfolio_key_id') === 'mirror-account'
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/al/contexts')) data = [
        { portfolio_key_id: 'dev-account', display_name: 'Development', profile: 'development', paper: true },
        { portfolio_key_id: 'mirror-account', display_name: 'Mirror', profile: 'mirror', paper: false }]
      else if (path.endsWith('/al/portfolio')) data = { account: { equity: mirror ? 22000 : 11000, cash: 5000, buying_power: 10000, currency: 'USD' }, positions: [{ symbol: mirror ? 'MSFT' : 'AAPL', side: 'long', qty: '10', avg_entry_price: '90', current_price: '100', market_value: '1000', unrealized_pl: '100' }] }
      else if (path.endsWith('/portfolio-history')) data = { timeframe: url.searchParams.get('timeframe'), cache: { mode: 'remote+cached' }, points: [10000, 12000, 9000, 11000].map((equity, i) => ({ timestamp: `2026-10-26T1${i}:00:00Z`, equity: equity * (mirror ? 2 : 1) })) }
      else if (path.endsWith('/al/orders')) data = { orders: url.searchParams.get('status') === 'open' ? [] : [{ id: 'order1', symbol: 'AAPL', side: 'buy', type: 'limit', status: 'filled', qty: '10', filled_qty: '10', filled_avg_price: '100', submitted_at: '2026-10-26T10:00:00Z', filled_at: '2026-10-26T10:01:00Z', client_order_id: 'client1' }], truncated: false }
      else if (path.endsWith('/al/activities')) data = { activities: [{ id: 'fill1', symbol: 'AAPL', side: 'buy', qty: 10, price: 100, timestamp: '2026-10-26T10:01:00Z', order_id: 'order1' }, { id: 'fill2', symbol: 'MSFT', side: 'sell', qty: 2, price: 200, timestamp: '2026-10-26T10:02:00Z', order_id: 'order2' }, { id: 'fill3', symbol: 'AAPL', side: 'sell', qty: 10, price: 101, timestamp: '2026-10-26T12:01:00Z', order_id: 'order3' }], cache: { mode: 'remote+cached' } }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(`${process.env.DASH_PREVIEW_URL || 'https://127.0.0.1:1443'}/dash/#/Alpaca`)
    await page.getByText('TF effettivo 5Min', { exact: false }).waitFor()
    assert.equal(await page.locator('canvas').count() > 0, true)
    await page.getByText('DD days · massimo', { exact: false }).waitFor()
    await page.getByText('Media per giorno', { exact: false }).waitFor()
    await page.getByLabel('Periodo', { exact: true }).click()
    assert.equal(await page.getByRole('option', { name: '3 mesi', exact: true }).count(), 0)
    const before = requests.filter(row => row.path.endsWith('/portfolio-history')).length
    const autoLoad = page.waitForResponse(response => response.url().includes('/portfolio-history'))
    await page.getByRole('option', { name: '30 giorni', exact: true }).click()
    await autoLoad
    await page.waitForFunction(() => !document.querySelector('.q-btn--loading'))
    const newHistory = requests.filter(row => row.path.endsWith('/portfolio-history')).slice(before)
    assert.equal(newHistory.length, 2)
    assert.ok(newHistory.every(row => row.tf === '5Min'))
    await page.getByLabel('Simboli sul grafico', { exact: true }).click()
    await page.getByRole('option', { name: 'AAPL', exact: true }).click()
    await page.getByRole('option', { name: 'MSFT', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByTestId('marker-count').filter({ hasText: '3 movimenti marcati su 3' }).waitFor()
    await page.getByText('▲ Ingresso', { exact: true }).waitFor()
    await page.getByText('▼ Uscita', { exact: true }).waitFor()
    await page.getByText('Dettaglio ingressi e uscite', { exact: true }).click()
    await page.getByRole('columnheader', { name: /Ciclo/ }).waitFor()
    const ledger = page.locator('.q-expansion-item').filter({ hasText: 'Dettaglio ingressi e uscite' })
    assert.equal(await ledger.getByRole('cell', { name: '1', exact: true }).count(), 3)
    await page.locator('.q-menu').waitFor({ state: 'hidden' })
    await page.screenshot({ path: '/tmp/alpaca-dashboard-markers.png', fullPage: true })
    const selectAndLoad = async (label, option) => {
      const load = page.waitForResponse(response => response.url().includes('/portfolio-history'))
      await page.getByLabel(label, { exact: true }).click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await load
      await page.waitForFunction(() => !document.querySelector('.q-btn--loading'))
    }
    await selectAndLoad('TF equity', '1D · storico giornaliero')
    await selectAndLoad('Periodo', '3 mesi')
    await page.getByLabel('TF equity', { exact: true }).click()
    assert.equal(await page.getByRole('option').count(), 1)
    assert.equal(await page.getByRole('option', { name: '5Min · fino a 30 giorni', exact: true }).count(), 0)
    await page.keyboard.press('Escape')
    await selectAndLoad('Periodo', '30 giorni')
    await selectAndLoad('TF equity', '5Min · fino a 30 giorni')
    await page.getByText('Dettaglio ingressi e uscite', { exact: true }).click()
    await ledger.getByRole('columnheader', { name: /Ciclo/ }).waitFor({ state: 'hidden' })
    await page.getByRole('tab', { name: 'Ordini', exact: true }).click()
    await page.getByRole('cell', { name: 'order1', exact: true }).click()
    await page.getByText('Client ID client1', { exact: false }).waitFor()
    await page.getByText('Timestamp restituiti dal broker;', { exact: false }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Analisi', exact: true }).click()
    await page.getByRole('columnheader', { name: /Saldo di cassa/ }).waitFor()
    const context = page.getByLabel('Spazio Alpaca', { exact: true })
    await context.click()
    await page.getByRole('option', { name: 'Mirror · Real', exact: true }).click()
    await page.getByText('REAL', { exact: true }).waitFor()
    await page.getByText('TF effettivo 5Min', { exact: false }).waitFor()
    await page.getByRole('tab', { name: 'Posizioni attuali', exact: true }).click()
    await page.getByRole('cell', { name: 'MSFT', exact: true }).waitFor()
    assert.equal(await page.getByRole('cell', { name: 'AAPL', exact: true }).count(), 0)
    const lastContext = requests.filter(row => row.path.includes('/al/') && !row.path.endsWith('/contexts')).slice(-6)
    assert.ok(lastContext.every(row => row.context === 'mirror-account'))
    await page.screenshot({ path: '/tmp/alpaca-dashboard-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/alpaca-dashboard-mobile.png', fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
    assert.deepEqual(errors, [])
    console.log('Dashboard rendered on served PWA; chart, account switch, order details, analysis and mobile layout passed (fixture data).')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
