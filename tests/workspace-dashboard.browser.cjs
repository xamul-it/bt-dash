// Browser acceptance against the staged PWA, with API fixtures and no broker writes.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = process.env.BT_DASH_DIST_DIR || '/tmp/bt-ui-review'
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
;(async () => {
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.replace(/^\/dash\/?/, '') || 'index.html'
    const file = path.join(dist, name)
    if (!file.startsWith(path.resolve(dist) + '/') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })
    const errors = [], writes = []
    page.on('pageerror', error => errors.push(error.message))
    const favorites = { schedule: ['a'], cron: ['live'], intraday: ['portfolio/live'] }
    const config = { label: 'Esperimento periodico', strategy: 'example.Strategy', fromdate: '2026-01-01', todate: '2026-10-31', broker: { margin_leverage: 1 } }
    const run = (id, schedule, status, created) => ({ id, kind: 'simulation', done: true, status, created_at: created, archive: { pinned: true }, request_snapshot: { schedule_id: schedule, configuration: { ...config, label: schedule ? config.label : 'SINGOLO NON IN DASHBOARD' } }, result: { performance: { total_return_pct: 4, trades: 8 } } })
    const jobs = [run('single', null, 'completed', '2026-11-01'), run('failed', 'a', 'failed', '2026-10-31'), run('old', 'a', 'completed', '2026-10-30')]
    const schedules = [{ id: 'a', label: config.label, configuration: config, enabled: true, last_job_id: 'failed', hour: 20, minute: 0 }]
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), p = url.pathname
      let data = []
      if (request.method() !== 'GET') {
        writes.push(p)
        assert.ok(p.endsWith('/dashboard-favorites'), 'Only preference mutations are allowed in acceptance test')
      }
      if (p.endsWith('/dashboard-favorites')) {
        if (request.method() === 'PUT') {
          const body = request.postDataJSON(), ids = new Set(favorites[body.kind] || [])
          if (body.favorite) ids.add(body.id); else ids.delete(body.id)
          favorites[body.kind] = [...ids]
        }
        data = favorites
      } else if (p.endsWith('/auth/me')) data = { authenticated: true, user: 'fixture' }
      else if (p.endsWith('/sc/status')) data = { status: 'running' }
      else if (p.endsWith('/simulations/jobs')) data = url.searchParams.has('schedule_id') ? jobs.filter(row => row.request_snapshot.schedule_id === url.searchParams.get('schedule_id')) : jobs
      else if (p.endsWith('/simulations/schedules')) data = schedules
      else if (p.endsWith('/cron/profiles')) data = [{ profile: 'live', strategy: 'ScheduledStrategy', pending_reconciliation_count: 2, open_guardrail_alert_count: 1 }]
      else if (p.endsWith('/cron/live/performance')) data = { profile: 'live', account_label: 'Conto live', paper: false, coverage_note: 'Primo eseguito registrato', periods: [
        { key: 'inception', label: 'Dall’avvio operativo', start: '2026-08-01T20:00:00Z', observed_from: '2026-07-31T20:00:00Z', updated_at: '2026-10-30T20:00:00Z', total_return_pct: 12.34, max_drawdown_pct: -3.21, initial_equity: 10000, final_equity: 11234, trades: 12, sessions: 60, notices: [] },
        { key: 'current', label: 'Dall’ultima modifica dei parametri', start: '2026-10-01T20:00:00Z', observed_from: '2026-09-30T20:00:00Z', updated_at: '2026-10-30T20:00:00Z', total_return_pct: 6.78, max_drawdown_pct: -1.23, initial_equity: 10500, final_equity: 11234, trades: 4, sessions: 20, notices: ['Possibili posizioni ereditate, dagli eseguiti registrati: AAPL'] },
      ] }
      else if (p.endsWith('/watchtower/windows')) data = [{ window_open: '2026-10-30T13:30:00Z' }]
      else if (p.endsWith('/portfolio-contexts')) data = [{ portfolio_key_id: 'portfolio/live', display_name: 'Intraday Live', chain_run_count: 1, run_count: 3 }]
      else if (p.endsWith('/coherence-summary')) data = { factsheet: { performance_rows: [{ group: 'live', sample_size: 3, win_rate: 66.67, mean: 0.2 }] } }
      else if (p.endsWith('/catalog')) data = { strategies: [], benchmarks: [], ticker_lists: [], profiles: [] }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    const base = `http://127.0.0.1:${server.address().port}/dash/`
    await page.goto(base + '#/')
    await page.getByText('Esperimento periodico', { exact: true }).waitFor()
    await page.getByText('Intraday Live', { exact: true }).waitFor()
    assert.equal(await page.getByText('SINGOLO NON IN DASHBOARD').count(), 0)
    const cron = page.getByRole('region', { name: 'Strategie schedulate', exact: true })
    await cron.getByText('Dall’avvio operativo', { exact: true }).waitFor()
    await cron.getByText('Dall’ultima modifica dei parametri', { exact: true }).waitFor()
    for (const value of ['12.34%', '6.78%', '-3.21%', '-1.23%', 'Possibili posizioni ereditate, dagli eseguiti registrati: AAPL']) assert.ok((await cron.innerText()).includes(value), value)
    assert.equal(await cron.getByText('Baseline', { exact: true }).count(), 0)
    assert.ok((await page.locator('body').innerText()).includes('failed'))
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}`)
      await page.screenshot({ path: `/tmp/workspace-dashboard-${width}.png`, fullPage: true })
    }
    const laboratory = page.getByRole('region', { name: 'Laboratorio schedulato', exact: true })
    await laboratory.getByRole('button', { name: 'Rimuovi dai preferiti della dashboard' }).click()
    await page.getByText('Esperimento periodico', { exact: true }).waitFor({ state: 'detached' })
    await page.reload()
    await page.getByText('Intraday Live', { exact: true }).waitFor()
    assert.equal(await page.getByText('Esperimento periodico', { exact: true }).count(), 0)
    await page.goto(base + '#/Laboratory/Schedules')
    await page.getByText('Esperimento periodico', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Aggiungi ai preferiti della dashboard' }).click()
    await page.getByRole('button', { name: 'Rimuovi dai preferiti della dashboard' }).waitFor()
    await page.getByRole('button', { name: 'Storico (2)' }).click()
    await page.getByText('Ultimo esito: completed').waitFor()
    await page.goto(base + '#/ExecuteStrategy')
    await page.getByRole('button', { name: 'Apri', exact: true }).first().waitFor()
    assert.equal(await page.getByRole('button', { name: 'Apri', exact: true }).count(), 2)
    await page.getByLabel('Mostra storico schedulazioni').click()
    assert.equal(await page.getByRole('button', { name: 'Apri', exact: true }).count(), 3)
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    for (const label of ['Laboratorio', 'Strategie schedulate', 'Strategie intraday', 'Portafoglio', 'Strumenti business', 'Tecnologia']) {
      assert.ok(await page.locator('.navigation-drawer').getByText(label, { exact: true }).count(), label)
    }
    assert.equal(writes.length, 2)
    assert.deepEqual(errors, [])
    console.log('Dashboard favorites, persistence, failed latest, scoped history, laboratory grouping and responsive navigation verified.')
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exitCode = 1 })
