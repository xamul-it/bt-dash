const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } })
    const errors = [], chartQueries = [], saves = []
    page.on('pageerror', e => errors.push(e.message))
    let deleted = false, sequence = 0, replayState = { state: 'STOPPED', running: false }
    const rows = [
      { symbol: 'AAPL', event_type: 'quote', timestamp: '2026-07-14T13:30:00Z', bid_price: 100, ask_price: 101 },
      { symbol: 'AAPL', event_type: 'trade', timestamp: '2026-07-14T13:30:00.050Z', price: 100.5, size: 3 },
      { symbol: 'AAPL', event_type: 'quote', timestamp: '2026-07-14T20:00:00Z', bid_price: 99, ask_price: 100 },
      { symbol: 'AAPL', event_type: 'quote', timestamp: '2026-07-15T13:30:00Z', bid_price: 102, ask_price: 103 }
    ]
    const windows = [{ id: 1, date: '2026-07-14', session: 'RTH', start_ns: Date.parse(rows[0].timestamp) * 1e6, end_ns: Date.parse(rows[1].timestamp) * 1e6, event_count: 2 }, { id: 2, date: '2026-07-14', session: 'After-hours', start_ns: Date.parse(rows[2].timestamp) * 1e6, end_ns: Date.parse(rows[2].timestamp) * 1e6, event_count: 1 }, { id: 3, date: '2026-07-15', session: 'RTH', start_ns: Date.parse(rows[3].timestamp) * 1e6, end_ns: Date.parse(rows[3].timestamp) * 1e6, event_count: 1 }]
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname
      let data = {}
      if (path.endsWith('/auth/status')) data = { authed: true }
      else if (path.endsWith('/al/contexts')) data = [{ portfolio_key_id: 'p', display_name: 'Account', paper: true }, { portfolio_key_id: 'live', display_name: 'Live', paper: false }]
      else if (path.endsWith('/al/portfolio')) data = { positions: [{ symbol: 'AAPL', qty: url.searchParams.get('portfolio_key_id') === 'live' ? '5' : '12', side: 'long', avg_entry_price: url.searchParams.get('portfolio_key_id') === 'live' ? '250' : '100.25' }] }
      else if (path.endsWith('/al/activities')) data = { activities: [] }
      else if (path.endsWith('/quote-monitor/admin')) data = { fresh: true, updated_at: Date.now() / 1000, proxy_connected: true, feed: 'sip', services: [{ name: 'zmq-proxy.service', active_ok: true, active: 'active', sub: 'running' }], proxy: { clients: [{ id: 'one', identity: 'strategy-client-1', application: 'bt-core', heartbeat_age_seconds: 0, subscriptions: ['minute', 'quote', 'trade'].map(channel => ({ symbol: 'AAPL', channel })) }] }, registrations: { watchtower: ['AAPL'] }, counters: { 'AAPL:trade': 1 } }
      else if (path.endsWith('/quote-monitor/live')) { data = { session_id: 'session', sequence: sequence + 4, rows: rows.map((row, i) => ({ ...row, sequence: sequence + i + 1 })), gap: false, reset: false }; sequence += 4 }
      else if (path.endsWith('/quote-monitor/archives')) data = { rows: deleted ? [] : [{ symbol: 'AAPL', bytes: 1000000000, modified_at: 1793124000, version: 'v1' }] }
      else if (path.endsWith('/archives/AAPL/index')) data = { state: 'READY', windows, events: 4 }
      else if (path.endsWith('/archives/AAPL/chart')) {
        chartQueries.push(url.searchParams.get('windows'))
        const selected = url.searchParams.get('windows') === '1,3' ? [rows[0], rows[1], rows[3]] : rows
        data = { rows: selected, start: Date.parse(rows[0].timestamp) / 1000, end: Date.parse(rows[3].timestamp) / 1000, events: 4, window_count: selected.length === 3 ? 2 : 3, sampled: true }
      } else if (path.endsWith('/quote-monitor/replay')) {
        if (route.request().method() === 'POST') {
          const body = JSON.parse(route.request().postData()); assert.deepEqual(body.symbols, ['AAPL'])
          replayState = { state: 'IDLE', running: true, available: { AAPL: { minute: 1, quote: 2, trade: 1 } }, req_addr: 'tcp://127.0.0.1:5557', pub_addr: 'tcp://127.0.0.1:5558', total_events: 4 }
        } else if (route.request().method() === 'DELETE') replayState = { state: 'STOPPED', running: false }
        data = replayState
      } else if (path.endsWith('/quote-monitor/replay/control')) { replayState = { ...replayState, state: 'EOD_SIGNALED', preview: { active: true, received: 4, rows } }; data = { accepted: true } }
      else if (path.endsWith('/archives/AAPL') && route.request().method() === 'DELETE') { assert.equal(JSON.parse(route.request().postData()).confirm_symbol, 'AAPL'); deleted = true; data = { deleted: true } }
      else if (path.endsWith('/registrations/watchtower')) { if (route.request().method() === 'PUT') saves.push(JSON.parse(route.request().postData())); data = { symbols: saves.at(-1)?.symbols || ['AAPL'] } }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('https://127.0.0.1:1443/dash/#/Zmq/Monitoring')
    await page.locator('.q-page .q-card').first().getByText('Mercato in tempo reale', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'strategy-client-1', exact: true }).first().waitFor()
    await page.getByRole('img', { name: 'Grafico finanziario bid ask e scambi' }).locator('canvas').first().waitFor()
    assert.equal(await page.locator('.q-drawer a[href*="/Zmq/"]').count(), 4)
    assert.equal(await page.locator('.market-viewer .q-table__container').isVisible(), false)
    await page.getByLabel('Posizioni aperte sul grafico').getByText('Account · Paper', { exact: false }).waitFor()
    await page.getByLabel('Posizioni aperte sul grafico').getByText('Live · Reale', { exact: false }).waitFor()
    await page.getByLabel('Posizioni aperte sul grafico').getByText('PMC 250', { exact: false }).waitFor()
    await page.locator('.market-viewer__toolbar .q-chip').first().click()
    await page.getByLabel('Posizioni aperte sul grafico').getByText('PMC 250', { exact: false }).waitFor()
    await page.locator('.market-viewer__toolbar .q-chip').first().click()
    await page.getByText('Periodo nel campione per AAPL:', { exact: false }).waitFor()
    assert.equal(await page.locator('.q-drawer a[href*="/Zmq/"] .q-icon').count(), 0)
    const activeColor = await page.locator('.q-drawer a[href$="/Zmq/Monitoring"]').evaluate(el => getComputedStyle(el).color)
    assert.equal(activeColor, 'rgb(255, 255, 255)')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const toolsFit = await page.locator('.market-viewer__tools').evaluate(el => el.getBoundingClientRect().right <= innerWidth)
    assert.ok(toolsFit)
    await page.screenshot({ path: '/tmp/zmq-monitor-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.screenshot({ path: '/tmp/zmq-monitor-redesign.png', fullPage: true })
    await page.goto('https://127.0.0.1:1443/dash/#/Zmq/History')
    assert.equal(await page.getByRole('button', { name: 'Consulta', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Prepara proxy replay', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Grafico storico AAPL', exact: true }).click()
    await page.getByText('3 finestre salvate', { exact: true }).waitFor()
    await page.getByText('1 selezionate su 3', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Tutte le finestre', exact: true }).click()
    await page.getByText('3 selezionate su 3', { exact: true }).waitFor()
    await page.getByLabel('Posizioni aperte sul grafico').getByText('Live · Reale', { exact: false }).waitFor()
    await page.getByRole('img', { name: 'Grafico finanziario bid ask e scambi' }).locator('canvas').first().waitFor()
    await page.getByLabel('Finestre da visualizzare', { exact: true }).click()
    await page.getByRole('checkbox').nth(1).click(); await page.keyboard.press('Escape')
    await page.getByText('2 selezionate su 3', { exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('.q-inner-loading'))
    assert.ok(chartQueries.includes('1,3'))
    const queryCount = chartQueries.length
    await page.getByRole('button', { name: 'Deseleziona tutte', exact: true }).click()
    await page.getByText('0 selezionate su 3', { exact: true }).waitFor()
    await page.getByText('Nessun tick registrato nel periodo.', { exact: true }).waitFor()
    assert.equal(chartQueries.length, queryCount)
    await page.getByLabel('Finestre da visualizzare', { exact: true }).click()
    await page.getByRole('checkbox').nth(0).click(); await page.keyboard.press('Escape')
    await page.getByText('1 selezionate su 3', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Tutte le finestre', exact: true }).click()
    await page.getByText('3 selezionate su 3', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Espandi grafico', exact: true }).first().click()
    await page.locator('.market-viewer--fullscreen').waitFor()
    await page.getByRole('button', { name: 'Espandi grafico', exact: true }).first().click()
    await page.screenshot({ path: '/tmp/zmq-history-redesign.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.q-table__grid-content').waitFor()
    await page.getByRole('button', { name: 'Grafico storico AAPL', exact: true }).waitFor({ state: 'visible' })
    await page.screenshot({ path: '/tmp/zmq-history-redesign-mobile.png', fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
    await page.getByRole('link', { name: 'Replay AAPL', exact: true }).click()
    await page.getByText('Replay tramite proxy ZMQ', { exact: true }).waitFor()
    await page.getByLabel('Data registrata · New York').fill('2026-07-14')
    await page.getByRole('button', { name: 'Prepara proxy replay', exact: true }).click()
    await page.getByText('Pronto · in attesa di client', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Registra dashboard e avvia replay', exact: true }).click()
    await page.getByText('4 ricevuti dalla dashboard', { exact: true }).waitFor()
    await page.getByLabel('Posizioni aperte sul grafico').getByText('Live · Reale', { exact: false }).waitFor()
    await page.goto('https://127.0.0.1:1443/dash/#/Watchtower/FeedMonitoring')
    await page.getByLabel('Simboli richiesti da Watchtower').fill('MSFT'); await page.getByLabel('Simboli richiesti da Watchtower').press('Enter')
    await page.getByRole('button', { name: 'Salva simboli Watchtower', exact: true }).click()
    await page.getByText('Lista salvata.', { exact: false }).waitFor()
    assert.deepEqual(saves[0].symbols, ['AAPL', 'MSFT'])
    assert.deepEqual(errors, [])
    console.log('PASS four ZMQ pages, grouped navigation, chart-first monitor, financial chart/fullscreen, selectable history windows, separate replay, Watchtower, mobile')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
