const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
 const browser = await chromium.launch({ headless: true })
 try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const rows = [2, 10].map((v, i) => ({ id: `run-${i}`, kind: 'simulation', done: true, status: 'completed', created_at: `2026-0${i + 1}-01T12:00:00Z`, request_snapshot: { configuration: { label: `Run ${i}`, strategy: 'generic.BuyAndHold', fromdate: '2020-01-01', todate: '2026-01-01', cash: 12345, parameters: { period: 17 } } }, result: { performance: { total_return_pct: v, sharpe: v, sortino: v, volatility_pct: v, average_trade_return_pct: v } } }))
  let saved
  await page.route('**/api/**', route => {
   const url = new URL(route.request().url()); let data = []
   if (url.pathname.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: ['none'], ticker_lists: [], profiles: [] }
   else if (url.pathname.endsWith('/strategy')) data = { parameters: [{ name: 'period', type: 'int', default: 5 }] }
   else if (url.pathname.endsWith('/jobs')) data = rows
   else if (/\/jobs\/run-\d$/.test(url.pathname)) data = rows.find(r => url.pathname.endsWith(r.id))
   else if (url.pathname.endsWith('/schedules') && route.request().method() === 'POST') { saved = route.request().postDataJSON(); data = { id: 'schedule', ...saved } }
   return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('https://127.0.0.1:1443/dash/#/ExecuteStrategy')
  await page.getByRole('row').filter({ hasText: 'Run 0' }).waitFor()
  assert.equal(await page.getByLabel('Capitale iniziale', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('tab', { name: 'Simulazioni giornaliere' }).count(), 0)
  for (const label of ['Avvio', 'Rendimento', 'Sharpe', 'Sortino', 'Volatilità annua', 'Rendimento medio / trade']) {
   await page.getByRole('columnheader', { name: label, exact: true }).click()
   let rendered = await page.locator('tbody tr').allTextContents()
   assert.ok(rendered[0].includes('Run 0'), label)
   await page.getByRole('columnheader', { name: label, exact: true }).click()
   rendered = await page.locator('tbody tr').allTextContents()
   assert.ok(rendered[0].includes('Run 1'), label)
  }
  const row = page.getByRole('row').filter({ hasText: 'Run 0' })
  await row.getByRole('button', { name: 'Schedula', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Salva', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(saved.source_job_id, 'run-0'); assert.equal(saved.configuration.cash, 12345)
  await row.getByRole('button', { name: 'Apri', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Nuovo run', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(await page.getByLabel('Capitale iniziale', { exact: true }).inputValue(), '12345')
  assert.deepEqual(errors, [])
  await page.screenshot({ path: '/tmp/backtesting-list-metrics.png' })
  console.log('Numeric/date sorting, row scheduling and detail cloning verified')
 } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
