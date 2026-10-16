// Run after quasar build; uses an isolated static server and mocked API (no real writes/downloads).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '../dist/spa');
  const server = http.createServer((req, res) => {
    const relative = new URL(req.url, 'http://localhost').pathname.replace(/^\/dash\/?/, '');
    const file = path.resolve(root, relative || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let rows = [{ ticker: 'tech.json', name: 'tech', label: 'Technology', count: 2, symbols: ['AAPL', 'MSFT'],
      sources: [{ provider: 'yahoo_adj', alpaca_feed: 'sip', download_enabled: false, benchmark_enabled: false }],
      download_enabled: false, benchmark_enabled: false, last_batch: null, last_success_at: null }];
    let archived = [];
    const saves = [];
    const json = (route, value) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace('/api', '');
      if (endpoint === '/dyn/simulations/ticker-lists') {
        if (request.method() === 'GET') return json(route, url.searchParams.get('archived') === '1' ? archived : rows.filter(r => !url.searchParams.get('symbol') || r.symbols.includes(url.searchParams.get('symbol').toUpperCase())));
        const multipart = request.headers()['content-type']?.includes('multipart');
        const body = multipart ? JSON.parse(request.postData().match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)[1]) : request.postDataJSON();
        saves.push(body);
        const ticker = body.ticker.endsWith('.json') ? body.ticker : body.ticker + '.json';
        let row = rows.find(r => r.ticker === ticker);
        if (!row) { row = { ticker, count: 2, symbols: ['NVDA', 'AMD'] }; rows.push(row); }
        Object.assign(row, body, { ticker, sources: body.providers.map(provider => ({ provider, alpaca_feed: body.alpaca_feed })) });
        return json(route, row);
      }
      if (endpoint.endsWith('/archive')) { const ticker = decodeURIComponent(endpoint.split('/').at(-2)); archived.push(rows.find(r => r.ticker === ticker)); rows = rows.filter(r => r.ticker !== ticker); return json(route, { archived: true }); }
      if (endpoint.endsWith('/restore')) { rows.push(archived.pop()); return json(route, rows.at(-1)); }
      if (endpoint === '/dyn/simulations/catalog') return json(route, { ticker_lists: rows.map(r => ({ value: r.ticker, label: r.label })) });
      if (endpoint === '/dyn/simulations/data' || endpoint === '/dyn/simulations/jobs') return json(route, []);
      return json(route, { status: 'running' });
    });
    const base = `http://127.0.0.1:${server.address().port}/dash/#`;
    await page.goto(base + '/TickerLists');
    await page.getByRole('button', { name: 'Technology', exact: true }).waitFor();
    await page.getByRole('switch', { name: 'Benchmark Technology', exact: true }).click();
    await page.waitForResponse(r => r.url().includes('/ticker-lists') && r.request().method() === 'POST');
    assert.equal(saves.at(-1).benchmark_enabled, true);
    assert.equal(saves.at(-1).download_enabled, true);
    await page.getByRole('switch', { name: 'Download giornaliero Technology', exact: true }).click();
    await page.waitForResponse(r => r.url().includes('/ticker-lists') && r.request().method() === 'POST');
    assert.equal(saves.at(-1).benchmark_enabled, false);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('symbol=ZZZZ')),
      page.getByLabel('Simbolo esatto presente nelle liste').fill('ZZZZ'),
    ]);
    await page.getByRole('button', { name: 'Technology', exact: true }).waitFor({ state: 'hidden' });
    await page.getByLabel('Simbolo esatto presente nelle liste').fill('aapl');
    await page.getByRole('button', { name: 'Technology', exact: true }).click();
    await page.waitForURL(/Configure/);
    assert.match(page.url(), /ticker=tech.json/);
    assert.match(page.url(), /provider=yahoo_adj/);
    await page.goto(base + '/TickerLists');
    await page.getByRole('button', { name: 'Nuova lista', exact: true }).click();
    await page.getByLabel('Identificativo file').fill('chips');
    await page.getByLabel('Nome lista', { exact: true }).fill('Chips');
    await page.locator('input[type=file]').setInputFiles({ name: 'chips.txt', mimeType: 'text/plain', buffer: Buffer.from('NVDA\nAMD\n') });
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await page.getByRole('button', { name: 'Chips', exact: true }).waitFor();
    const chips = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Chips', exact: true }) });
    await chips.getByRole('button', { name: 'Archivia lista', exact: true }).click();
    await page.getByRole('button', { name: 'Archivia', exact: true }).click();
    await page.getByRole('button', { name: 'Chips', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('switch', { name: 'Archiviate', exact: true }).click();
    await page.getByRole('button', { name: 'Ripristina', exact: true }).click();
    await page.getByRole('switch', { name: 'Archiviate', exact: true }).click();
    await page.getByRole('button', { name: 'Chips', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Ticker lists browser: flags, symbol search, navigation, import, archive/restore, mobile OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
