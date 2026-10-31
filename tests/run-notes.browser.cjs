// Served PWA with mocked API; never writes real run metadata.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const run = { id: 'notes-run', kind: 'simulation', done: true, status: 'completed', request_snapshot: { configuration: { label: 'Original', strategy: 'generic.BuyAndHold' } }, archive: {}, result: { artifacts: [] } }
    let saved = null
    await page.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname
      let data = []
      if (endpoint.endsWith('/catalog')) data = { strategies: [{ label: 'BuyAndHold', value: 'generic.BuyAndHold' }], benchmarks: [], providers: ['yahoo_adj'], timeframes: ['daily'], commissions: ['none'], profiles: [], ticker_lists: [] }
      else if (endpoint.endsWith('/strategy')) data = { parameters: [] }
      else if (endpoint.endsWith('/jobs')) data = [run]
      else if (endpoint.endsWith('/equity')) data = { points: [], benchmark_points: [], drawdown_points: [] }
      else if (endpoint.endsWith('/jobs/notes-run')) {
        if (route.request().method() === 'PATCH') { saved = route.request().postDataJSON(); run.archive = { ...run.archive, ...saved } }
        data = run
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/cdn.jsdelivr.net/**', route => route.abort())
    await page.goto('https://127.0.0.1:1443/dash/#/ExecuteStrategy', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: 'Risultati e archivio' }).click()
    assert.equal(await page.getByRole('button', { name: 'Note del run', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Apri', exact: true }).click()
    await page.getByRole('button', { name: 'Nome e note', exact: true }).click()
    const editor = page.getByRole('dialog').filter({ has: page.getByLabel('Note (Markdown)', { exact: true }) })
    await editor.getByLabel('Nome simulazione', { exact: true }).fill('Documented run')
    const notes = '# Studio\n\n**Risultato**\n\n- uno\n- due\n\n[documento](https://example.com)\n\n<script>window.notesInjected = true</script>\n\n[bad](javascript:alert(1))'
    await editor.getByLabel('Note (Markdown)', { exact: true }).fill(notes)
    await editor.locator('h1', { hasText: 'Studio' }).waitFor()
    assert.equal(await editor.locator('strong', { hasText: 'Risultato' }).count(), 1)
    assert.equal(await editor.locator('li').count(), 2)
    assert.equal(await editor.locator('script').count(), 0)
    assert.equal(await editor.locator('a[href^="javascript:"]').count(), 0)
    await editor.getByRole('button', { name: 'Salva', exact: true }).click()
    await editor.waitFor({ state: 'hidden' })
    assert.deepEqual(saved, { label: 'Documented run', notes })
    assert.equal(await page.evaluate(() => window.notesInjected), undefined)
    await page.getByRole('dialog').getByRole('button', { name: 'Chiudi dettaglio run', exact: true }).click()
    await page.getByRole('button', { name: 'Note del run', exact: true }).click()
    await page.getByRole('menu').locator('h1', { hasText: 'Studio' }).waitFor()
    await page.screenshot({ path: '/tmp/run-notes-markdown.png' })
    assert.deepEqual(errors, [])
    console.log('Name and notes editor, Markdown preview, saved info popup and safe HTML verified')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
