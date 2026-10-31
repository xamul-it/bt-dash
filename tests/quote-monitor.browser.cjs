const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } })
    let symbols = [], saved
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      let data = {}
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/al/contexts')) data = [{ portfolio_key_id: 'p', display_name: 'Test', paper: true }]
      else if (path.endsWith('/al/portfolio')) data = { positions: [{ symbol: 'MSFT' }] }
      else if (path.endsWith('/quote-monitor/config')) { saved = JSON.parse(route.request().postData()); symbols = saved.symbols; data = saved }
      else if (path.endsWith('/quote-monitor/status')) data = { logger_alive: true, proxy_connected: true, feed: 'sip', symbols, desired_symbols: symbols, manual_symbols: symbols, latest: symbols.includes('MSFT') ? { MSFT: { quote: { timestamp: new Date().toISOString(), bid_price: 121.5, ask_price: 121.6, bid_size: 5, ask_size: 10 }, trade: { timestamp: new Date().toISOString(), price: 121.55 } } } : {} }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/Zmq/Recording')
    await page.locator('.q-page').getByText('Titoli monitorati', { exact: true }).waitFor()
    await page.getByText('1. Scegli i titoli da registrare', { exact: true }).waitFor()
    await page.getByLabel('Conto Alpaca', { exact: true }).click(); await page.getByRole('option', { name: 'Test · Paper' }).click()
    await page.getByRole('button', { name: 'Aggiungi i titoli in portafoglio', exact: true }).click()
    await page.getByRole('button', { name: 'Salva lista di registrazione', exact: true }).click()
    await page.getByRole('cell', { name: 'MSFT', exact: true }).waitFor()
    assert.deepEqual(saved.symbols, ['MSFT'])
    await page.getByText('121,50', { exact: true }).waitFor()
    const spacing = await page.getByRole('link', { name: 'Flusso live', exact: true }).first().evaluate(button => {
      const icon = button.querySelector('.q-icon').getBoundingClientRect()
      const label = button.querySelector('.block').getBoundingClientRect()
      return label.left - icon.right
    })
    assert.ok(spacing >= 0 && spacing <= 8, `Live icon spacing: ${spacing}`)
    await page.getByText('Che cosa viene registrato?', { exact: true }).click()
    await page.getByText('Sono dati del mercato del titolo, non la liquidità o il saldo del tuo conto.', { exact: false }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '/tmp/zmq-registration-redesign-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS registration purpose, portfolio import, saved selection, market versus account distinction, mobile')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
