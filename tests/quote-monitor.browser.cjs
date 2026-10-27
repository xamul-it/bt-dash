const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } })
    let symbols = ['AAPL'], saved = null
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      let data = {}
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/al/contexts')) data = [{ portfolio_key_id: 'p', display_name: 'Test', paper: true }]
      else if (path.endsWith('/al/portfolio')) data = { positions: [{ symbol: 'MSFT' }] }
      else if (path.endsWith('/quote-monitor/config')) { saved = JSON.parse(route.request().postData()); symbols = saved.symbols; data = saved }
      else if (path.endsWith('/quote-monitor/status')) data = { logger_alive: true, proxy_connected: true, feed: 'sip', symbols, desired_symbols: symbols, latest: { AAPL: { quote: { bid_price: 100, ask_price: 101, timestamp: '2020-01-01T00:00:00Z' } } } }
      else if (path.includes('/recordings/')) data = { rows: [{ event_type: 'quote', timestamp: '2020-01-01T00:00:00Z', bid_price: 100 }], truncated: true, scope: 'Ultimi 500 eventi' }
      else if (path.includes('/history/')) data = { symbol: 'AAPL', date: '2026-10-01', feed: 'sip', rows: [{ bp: 100 }], next_page_token: 'more' }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/QuoteMonitoring')
    await page.getByText('Monitoraggio liquidità L1', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'Quote datate', exact: true }).waitFor()
    await page.getByLabel('Conto per consultare il portafoglio e lo storico').click()
    await page.getByRole('option', { name: 'Test · Paper' }).click()
    await page.getByRole('button', { name: 'Aggiungi posizioni', exact: true }).click()
    await page.getByRole('button', { name: 'Salva monitoraggio', exact: true }).click()
    await page.getByRole('cell', { name: 'MSFT', exact: true }).waitFor()
    assert.deepEqual(saved.symbols, ['AAPL', 'MSFT'])
    await page.getByRole('button', { name: 'Dati registrati', exact: true }).first().click()
    await page.getByText('Estratto parziale dello storico.', { exact: false }).waitFor()
    await page.getByRole('dialog').getByRole('button').first().click()
    await page.getByLabel('Ticker storico', { exact: true }).fill('AAPL')
    await page.getByLabel('Data della sessione USA', { exact: true }).fill('2026-10-01')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Scarica prima pagina', exact: true }).click()
    assert.equal((await download).suggestedFilename(), 'AAPL_2026-10-01_AH_sip_1.jsonl')
    await page.getByText('Storico parziale: scarica la pagina successiva.', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Scarica pagina successiva', exact: true }).waitFor()
    await page.screenshot({ path: '/tmp/quote-monitor-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/quote-monitor-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS selection, portfolio import, stale quotes, recording tail, paginated download, mobile')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
