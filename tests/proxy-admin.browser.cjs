const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } })
    const errors = [], saves = []
    page.on('pageerror', e => errors.push(e.message))
    let deleted = false, sequence = 0, replayState = { state: 'STOPPED', running: false }
    const rows = [
      { symbol: 'AAPL', event_type: 'quote', timestamp: '2026-10-27T20:00:00Z', bid_price: 100, ask_price: 101 },
      { symbol: 'AAPL', event_type: 'trade', timestamp: '2026-10-27T20:00:00.050Z', price: 100.5, size: 3 },
      { symbol: 'AAPL', event_type: 'quote', timestamp: '2026-10-27T20:00:00.100Z', bid_price: 99, ask_price: 100 }
    ]
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname
      let data = {}
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/quote-monitor/admin')) data = { fresh: true, updated_at: Date.now() / 1000, proxy_connected: true, feed: 'sip', services: [{ name: 'zmq-proxy.service', active_ok: true, active: 'active', sub: 'running' }], proxy: { clients: [{ id: 'one', identity: 'strategy-client-1', application: 'bt-core', heartbeat_age_seconds: 0, subscriptions: ['minute', 'quote', 'trade'].map(channel => ({ symbol: 'AAPL', channel })) }] }, registrations: { watchtower: ['AAPL'] }, counters: { 'AAPL:trade': 1 } }
      else if (path.endsWith('/quote-monitor/live')) { data = { session_id: 'session', sequence: sequence + 3, rows: rows.map((row, i) => ({ ...row, sequence: sequence + i + 1 })), gap: sequence > 0, reset: false }; sequence += 3 }
      else if (path.endsWith('/quote-monitor/replay')) {
        if (route.request().method() === 'POST') {
          const body = JSON.parse(route.request().postData())
          assert.deepEqual(body.symbols, ['AAPL'])
          assert.equal(body.date, '2026-07-14')
          assert.equal(body.speed, 60)
          replayState = { state: 'IDLE', running: true, available: { AAPL: { minute: 1, quote: 2, trade: 1 } }, req_addr: 'tcp://127.0.0.1:5557', pub_addr: 'tcp://127.0.0.1:5558', total_events: 4 }
        } else if (route.request().method() === 'DELETE') replayState = { state: 'STOPPED', running: false }
        data = replayState
      } else if (path.endsWith('/quote-monitor/replay/control')) {
        const body = JSON.parse(route.request().postData())
        if (body.action === 'preview_start') replayState = { ...replayState, state: 'EOD_SIGNALED', preview: { active: true, received: 3, rows } }
        else replayState = { ...replayState, state: 'IDLE', preview: { active: false, rows: [] } }
        data = { accepted: true }
      }
      else if (path.endsWith('/quote-monitor/archives')) data = { rows: deleted ? [] : [{ symbol: 'AAPL', bytes: 1000, modified_at: 1793124000, version: 'v1' }] }
      else if (path.endsWith('/archives/AAPL/events')) data = { rows, next_offset: 1000, bytes: 1000, complete: true }
      else if (path.endsWith('/recordings/AAPL')) data = { rows, truncated: true }
      else if (path.endsWith('/archives/AAPL') && route.request().method() === 'DELETE') { const body = JSON.parse(route.request().postData()); assert.equal(body.confirm_symbol, 'AAPL'); assert.equal(body.version, 'v1'); deleted = true; data = { deleted: true } }
      else if (path.endsWith('/registrations/watchtower')) {
        if (route.request().method() === 'PUT') saves.push(JSON.parse(route.request().postData()))
        data = { symbols: saves.at(-1)?.symbols || ['AAPL'] }
      } else if (path.endsWith('/feed-monitoring/meta')) data = {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/ProxyAdministration')
    await page.getByText('Simboli e applicazioni richiedenti', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'strategy-client-1', exact: true }).first().waitFor()
    await page.getByRole('img', { name: 'Bid, ask e tick sullo stesso asse temporale' }).waitFor()
    assert.ok(await page.locator('svg circle').count() > 0)
    await page.getByText('Campione incompleto:', { exact: false }).waitFor()
    await page.screenshot({ path: '/tmp/proxy-admin-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/proxy-admin-mobile.png', fullPage: true })
    await page.goto('https://127.0.0.1:1443/dash/#/RecordedFlows')
    await page.getByRole('button', { name: 'Consulta', exact: true }).click()
    await page.getByText('AAPL · estratto finale', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Replay ZMQ', exact: true }).click()
    await page.getByLabel('Data registrata · New York').fill('2026-07-14')
    await page.getByRole('button', { name: 'Prepara proxy replay', exact: true }).click()
    await page.getByText('Pronto · in attesa di client', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Registra dashboard e avvia replay', exact: true }).click()
    await page.getByText('3 ricevuti dalla dashboard', { exact: true }).waitFor()
    await page.getByText('Fine del flusso', { exact: true }).waitFor()
    assert.ok((await page.locator('svg circle').count()) > 0)
    assert.equal(await page.getByRole('button', { name: 'Download', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Arresta proxy replay', exact: true }).click()
    await page.getByText('Fermo', { exact: true }).waitFor()
    await page.screenshot({ path: '/tmp/recorded-flows-mobile.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancella', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Elimina definitivamente', exact: true }).isDisabled(), true)
    await page.getByLabel('Digita il simbolo per confermare').fill('AAPL')
    await page.getByRole('button', { name: 'Elimina definitivamente', exact: true }).click()
    await page.getByText('Nessuna registrazione disponibile', { exact: false }).waitFor()
    assert.equal(deleted, true)
    await page.goto('https://127.0.0.1:1443/dash/#/Watchtower/FeedMonitoring')
    await page.getByText('Registrazione flussi Watchtower', { exact: true }).waitFor()
    await page.getByLabel('Simboli richiesti da Watchtower').fill('MSFT')
    await page.getByLabel('Simboli richiesti da Watchtower').press('Enter')
    await page.getByRole('button', { name: 'Salva simboli Watchtower', exact: true }).click()
    await page.getByText('Lista salvata.', { exact: false }).waitFor()
    assert.deepEqual(saves[0].symbols, ['AAPL', 'MSFT'])
    assert.deepEqual(errors, [])
    console.log('PASS proxy clients, channels, live bid/ask+ticks, gaps, ZMQ replay controls, confirmed deletion, Watchtower registration, mobile')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
