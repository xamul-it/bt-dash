// API fixtures only: no runtime benchmark or schedule mutations.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
 const browser = await chromium.launch({ headless: true })
 try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  let definition = { id: 'scheduled', label: 'Lista schedulata', ticker: 'list.json', provider: 'yahoo_adj', fromdate: '2000-01-01', enabled: true, hour: 1, minute: 15 }
  let saved = null, refreshed = false
  await page.route('**/api/**', route => {
   const path = new URL(route.request().url()).pathname
   let data = []
   if (path.endsWith('/catalog')) data = { ticker_lists: [{ label: 'Lista', value: 'list.json' }] }
   else if (path.endsWith('/benchmark-definitions')) {
    if (route.request().method() === 'POST') { saved = route.request().postDataJSON(); definition = { ...saved }; data = definition }
    else data = [definition]
   } else if (path.endsWith('/refresh')) { refreshed = true; data = { id: 'job-test' } }
   else if (path.endsWith('/data')) data = [
    { symbol: 'ARM', available: true, first_bar: '2023-09-14', last_bar: '2026-10-23' },
    { symbol: 'EA', available: true, first_bar: '2000-01-03', last_bar: '2026-08-10' },
   ]
   else if (path.endsWith('/benchmarks')) data = ['run', 'csv', 'buyhold'].map(type => ({ name: type === 'buyhold' ? 'scheduled' : type, label: `Origine ${type}`, source_type: type, available: true, first_date: '2023-09-14', last_date: '2026-08-10', symbols: ['ARM', 'EA'], provider: 'yahoo_adj' }))
   return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('https://127.0.0.1:1443/dash/#/Benchmark')
  for (const [label, type] of [['Run statici', 'run'], ['CSV', 'csv'], ['Schedulati', 'buyhold']]) {
   await page.getByLabel('Provenienza', { exact: true }).click()
   await page.getByRole('option', { name: label, exact: true }).click()
   await page.getByRole('listbox').waitFor({ state: 'hidden' })
   assert.equal(await page.locator('tbody tr').count(), 1)
   await page.getByRole('cell', { name: `Origine ${type}`, exact: true }).waitFor()
  }
  await page.getByText('Periodo comune effettivo: 2023-09-14 → 2026-08-10').waitFor()
  await page.getByRole('button', { name: 'Perché queste date?', exact: true }).click()
  await page.getByRole('dialog').getByText('ARM', { exact: true }).waitFor()
  await page.getByRole('dialog').getByText('EA', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.q-transition--scale-enter-active'))
  await page.screenshot({ path: '/tmp/benchmark-coverage-limits.png' })
  await page.getByRole('button', { name: 'Chiudi copertura' }).click()
  await page.getByRole('button', { name: 'Modifica data inizio benchmark', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Storico da', { exact: true }).fill('2010-03-04')
  await dialog.getByRole('button', { name: 'Salva data', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByText('Storico richiesto da 2010-03-04', { exact: false }).waitFor()
  assert.equal(saved.fromdate, '2010-03-04'); assert.equal(saved.id, 'scheduled'); assert.equal(refreshed, true)
  await page.reload()
  await page.getByText('Storico richiesto da 2010-03-04', { exact: false }).waitFor()
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json())
  assert.ok(manifest.icons.some(i => i.src === 'icons/maskable-512.png'))
  assert.equal(await page.locator('link[rel="icon"][href*="favicon-32.png"]').count(), 1)
  assert.equal(await page.locator('link[href*="apple-icon-"]').count(), 0)
  assert.deepEqual(errors, [])
  console.log('Source filters, date save/reload/recalculation and new icon links verified')
 } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
