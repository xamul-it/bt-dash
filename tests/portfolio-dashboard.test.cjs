const { test } = require('node:test')
const assert = require('node:assert/strict')
const utils = import('../src/bt/utils/portfolioDashboard.mjs')

test('equity skips missing values, sorts and deduplicates actual samples', async () => {
  const { historySeries } = await utils
  const rows = historySeries([
    { timestamp: '2026-10-20T14:00Z', equity: 110 },
    { timestamp: '2026-10-20T13:00Z', equity: 100 },
    { timestamp: '2026-10-20T14:00Z', equity: 112 },
    { timestamp: '2026-10-20T15:00Z', equity: null },
    { timestamp: 'bad', equity: 3 }
  ])
  assert.deepEqual(rows.map(row => row.value), [100, 112])
})
test('drawdown is based on the running peak and missing history stays unavailable', async () => {
  const { equityStatistics } = await utils
  const stats = equityStatistics([100, 120, 90, 110].map((equity, i) => ({ timestamp: `2026-10-20T1${i}:00Z`, equity })))
  assert.equal(stats.maxDrawdown, -25)
  assert.equal(stats.change, 10)
  assert.deepEqual(stats.drawdown.map(row => Math.round(row.value)), [0, 0, -25, -8])
  assert.equal(equityStatistics([]).change, null)
})
test('long periods explicitly resolve to daily and custom bounds are validated', async () => {
  const { effectiveTimeframe, periodBounds } = await utils
  assert.equal(effectiveTimeframe('1Min', '2026-01-01', '2026-03-01'), '1D')
  assert.equal(effectiveTimeframe('5Min', '2026-01-01', '2026-01-08'), '5Min')
  assert.throws(() => periodBounds('CUSTOM', '2026-02-01', '2026-01-01'))
  assert.deepEqual(periodBounds('CUSTOM', '2026-01-01', '2026-01-02'), { after: '2026-01-01T00:00:00Z', until: '2026-01-02T23:59:59Z' })
})
test('today follows the New York date rather than the UTC date after midnight in Europe', async () => {
  const { periodBounds } = await utils
  const bounds = periodBounds('1D', '', '', new Date('2026-10-27T00:30:00Z'))
  assert.equal(bounds.after, '2026-10-26T04:00:00.000Z')
})

test('today uses New York midnight in winter and on DST transition dates', async () => {
  const { periodBounds } = await utils
  assert.equal(periodBounds('1D', '', '', new Date('2026-12-15T15:00:00Z')).after, '2026-12-15T05:00:00.000Z')
  assert.equal(periodBounds('1D', '', '', new Date('2026-03-08T15:00:00Z')).after, '2026-03-08T05:00:00.000Z')
  assert.equal(periodBounds('1D', '', '', new Date('2026-11-01T15:00:00Z')).after, '2026-11-01T04:00:00.000Z')
})

test('exactly 30 days retains 5Min and is split into continuous shorter requests', async () => {
  const { effectiveTimeframe, historyWindows, mergeHistoryResponses, periodBounds } = await utils
  const bounds = periodBounds('1M', '', '', new Date('2026-10-26T16:00:00Z'))
  const tf = effectiveTimeframe('5Min', bounds.after, bounds.until)
  assert.equal(tf, '5Min')
  const windows = historyWindows(bounds.after, bounds.until, tf)
  assert.equal(windows.length, 2)
  assert.equal(windows[0].start, bounds.after)
  assert.equal(windows[0].end, windows[1].start)
  assert.equal(windows[1].end, bounds.until)
  assert.ok(windows.every(w => Date.parse(w.end) - Date.parse(w.start) <= 29 * 86400000))
  const merged = mergeHistoryResponses([
    { timeframe: tf, cache: { mode: 'remote+cached' }, points: [{ timestamp: windows[0].start, equity: 100 }, { timestamp: windows[0].end, equity: 101 }] },
    { timeframe: tf, cache: { mode: 'remote+cached' }, points: [{ timestamp: windows[1].start, equity: 102 }, { timestamp: windows[1].end, equity: 103 }] }
  ])
  assert.equal(merged.points.length, 3)
  assert.equal(merged.points[1].equity, 102)
  assert.equal(merged.timeframe, '5Min')
  assert.equal(merged.cache.mode, 'remote+cached')
  assert.equal(historyWindows(bounds.after, bounds.until, '1D').length, 1)
})
test('a cached segment remains visible as a fallback after merging', async () => {
  const { mergeHistoryResponses } = await utils
  const result = mergeHistoryResponses([{ cache: { mode: 'remote+cached' } }, { cache: { mode: 'local-fallback', remote_error: 'offline' } }])
  assert.equal(result.cache.mode, 'local-fallback')
  assert.equal(result.cache.remote_error, 'offline')
})

test('history segments are requested sequentially and a failure stops the load', async () => {
  const { loadHistoryWindows } = await utils
  const seen = []
  let active = false
  await loadHistoryWindows([1, 2], async window => {
    assert.equal(active, false)
    active = true
    seen.push(window)
    await Promise.resolve()
    active = false
    return { points: [], cache: { mode: 'remote+cached' } }
  })
  assert.deepEqual(seen, [1, 2])
  const failed = []
  await assert.rejects(loadHistoryWindows([1, 2], async window => { failed.push(window); throw new Error('offline') }), /offline/)
  assert.deepEqual(failed, [1])
})

test('timeframe/horizon combinations hide unsupported choices and expose actual thresholds', async () => {
  const { validPeriods, validTimeframes, horizonDays } = await utils
  assert.deepEqual(validPeriods('5Min').map(row => row.value), ['1D', '1W', '1M', '3M', '1A', 'CUSTOM'])
  assert.ok(validTimeframes(30).some(row => row.value === '5Min' && row.label.includes('archivio')))
  assert.deepEqual(validTimeframes(31).map(row => row.value), ['5Min', '1D'])
  assert.ok(validPeriods('1D').some(row => row.value === '1A'))
  assert.equal(horizonDays('CUSTOM', '2026-01-01', '2026-01-30'), 30)
  assert.equal(horizonDays('CUSTOM', '2026-01-01', '2026-01-31'), 31)
  assert.equal(horizonDays('CUSTOM', '', ''), null)
})
test('5 minute history splits archive and recoverable recent interval', async () => {
  const { archivedHistoryWindows } = await utils
  const windows = archivedHistoryWindows('2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z', Date.parse('2026-03-01T00:00:00Z'))
  assert.equal(windows.length, 3)
  assert.equal(windows[0].archive_only, true)
  assert.equal(windows[0].end, windows[1].start)
  assert.equal(windows[1].start, '2026-01-30T00:00:00.000Z')
  assert.equal(windows[1].end, windows[2].start)
  const recent = archivedHistoryWindows('2026-01-30T00:00:00Z', '2026-03-01T00:00:00Z', Date.parse('2026-03-01T00:00:00Z'))
  assert.equal(recent.length, 2)
  assert.ok(recent.every(window => !window.archive_only))
  assert.equal(recent[0].start, '2026-01-30T00:00:00.000Z')
})
test('portfolio opens on live even when paper is listed first', async () => {
  const { defaultPortfolioContext } = await utils
  const contexts = [{ portfolio_key_id: 'paper', paper: true }, { portfolio_key_id: 'real', paper: false }, { portfolio_key_id: 'live', paper: false, profile: 'live' }]
  assert.equal(defaultPortfolioContext(contexts), 'live')
  assert.equal(defaultPortfolioContext(contexts.slice(0, 2)), 'real')
  assert.equal(defaultPortfolioContext(contexts.slice(0, 1)), 'paper')
  assert.equal(defaultPortfolioContext([]), '')
})
test('period indicators measure daily averages and actual elapsed drawdown duration', async () => {
  const { periodIndicators } = await utils
  const rows = [100, 120, 90, 120, 100].map((equity, index) => ({ timestamp: `2026-10-${19 + index}T20:00:00Z`, equity }))
  const daily = periodIndicators(rows, '1D')
  assert.equal(daily.pnl, 0)
  assert.equal(daily.maxDrawdown, -25)
  assert.equal(daily.maxDrawdownCash, 30)
  assert.equal(daily.ddDays, 2)
  assert.equal(daily.currentDdDays, 1)
  assert.equal(daily.sessions, 4)
  assert.equal(daily.averageDay, 0)
  assert.equal(periodIndicators([], '1D').averageDay, null)
  const intra = periodIndicators([
    { timestamp: '2026-10-23T14:00:00Z', equity: 100 },
    { timestamp: '2026-10-23T20:00:00Z', equity: 110 },
    { timestamp: '2026-10-26T14:00:00Z', equity: 90 }
  ])
  assert.equal(intra.sessions, 2)
  assert.equal(intra.averageDay, -5)
  assert.equal(intra.ddDays, 2.75)
})
test('multi-symbol markers use position direction, ticker and exact fill time', async () => {
  const { executionMarkers, symbolLegend } = await utils
  const points = [{ timestamp: '2026-10-26T14:00:00Z', equity: 100 }, { timestamp: '2026-10-26T14:05:00Z', equity: 101 }]
  const fills = [
    { id: 'a', symbol: 'AAPL', side: 'buy', qty: 1, timestamp: '2026-10-26T14:01:17Z', order_id: 'close-short' },
    { id: 'b', symbol: 'MSFT', side: 'sell', qty: 2, timestamp: '2026-10-26T14:01:18Z' },
    { id: 'c', symbol: 'AAPL', side: 'sell', qty: 1, timestamp: '2026-10-26T15:00:00Z' }
  ]
  assert.deepEqual(executionMarkers(points, fills, []), [])
  const markers = executionMarkers(points, fills, ['AAPL', 'MSFT'], [], '5Min', { AAPL: -1, MSFT: 2 })
  assert.equal(markers.length, 2)
  assert.equal(markers[0].action, 'Uscita')
  assert.equal(markers[0].shape, 'arrowDown')
  assert.equal(markers[1].action, 'Uscita')
  assert.equal(markers[1].shape, 'arrowDown')
  assert.match(markers[0].text, /AAPL/)
  assert.match(markers[1].text, /MSFT/)
  assert.equal(markers[0].fill.timestamp, '2026-10-26T14:01:17Z')
  assert.equal(markers[0].time, Date.parse(points[0].timestamp) / 1000)
  assert.notEqual(symbolLegend(['AAPL', 'MSFT'])[0].color, symbolLegend(['AAPL', 'MSFT'])[1].color)
  assert.equal(symbolLegend(['AAPL'])[0].color, symbolLegend(['AAA', 'AAPL'])[1].color)
})

test('daily markers include intraday fills on the final equity date', async () => {
  const { executionMarkers } = await utils
  const points = [{ timestamp: '2026-10-26T04:00:00Z', equity: 100 }]
  const fills = [{ id: 'last-day', symbol: 'AAPL', side: 'buy', qty: 1, timestamp: '2026-10-26T18:00:00Z' }]
  assert.equal(executionMarkers(points, fills, ['AAPL'], [], '1D').length, 1)
  assert.equal(executionMarkers(points, fills, ['AAPL'], [], '5Min').length, 0)
})

test('cycle numbers stay constant through scale-ins and partial exits until flat', async () => {
  const { positionCycles } = await utils
  const fill = (symbol, side, qty, minute) => ({ id: `${symbol}-${minute}`, symbol, side, qty, timestamp: `2026-10-26T14:${String(minute).padStart(2, '0')}:00Z` })
  const rows = positionCycles([
    fill('AAPL', 'buy', 10, 0), fill('MSFT', 'buy', 1, 1), fill('AAPL', 'buy', 5, 2),
    fill('AAPL', 'sell', 3, 3), fill('AAPL', 'buy', 2, 4), fill('AAPL', 'sell', 14, 5),
    fill('AAPL', 'buy', 4, 6), fill('AAPL', 'sell', 4, 7), fill('MSFT', 'sell', 1, 8)
  ])
  const aapl = rows.filter(row => row.symbol === 'AAPL')
  assert.deepEqual(aapl.map(row => row.cycle), [1, 1, 1, 1, 1, 2, 2])
  assert.deepEqual(aapl.map(row => row.action), ['Ingresso', 'Ingresso', 'Uscita', 'Ingresso', 'Uscita', 'Ingresso', 'Uscita'])
  assert.deepEqual(aapl.map(row => row.position_after), [10, 15, 12, 14, 0, 4, 0])
  assert.deepEqual(rows.filter(row => row.symbol === 'MSFT').map(row => row.cycle), [1, 1])
})
test('short cycles, reversals and fractional flats follow actual inventory', async () => {
  const { positionCycles, executionMarkers } = await utils
  const fill = (id, side, qty) => ({ id, symbol: 'AAA', side, qty, timestamp: `2026-10-26T14:0${id}:00Z` })
  const rows = positionCycles([fill(0, 'sell', .3), fill(1, 'buy', .1), fill(2, 'buy', .2), fill(3, 'buy', 2), fill(4, 'sell', 5), fill(5, 'buy', 3)])
  assert.deepEqual(rows.map(row => row.cycle), [1, 1, 1, 2, 2, 3, 3])
  assert.deepEqual(rows.map(row => row.action), ['Ingresso', 'Uscita', 'Uscita', 'Ingresso', 'Uscita', 'Ingresso', 'Uscita'])
  assert.equal(rows.at(-1).position_after, 0)
  assert.deepEqual(rows.filter(row => row.execution_id === 4).map(row => row.qty), [2, 3])
  const markers = executionMarkers([{ timestamp: '2026-10-26T14:00:00Z', equity: 100 }], [fill(0, 'sell', 2)], ['AAA'])
  assert.equal(markers[0].shape, 'arrowUp')
  assert.equal(markers[0].text, 'AAA #1')
})
test('opening inventory preserves a cycle already open before the displayed range', async () => {
  const { openingPositions, positionCycles } = await utils
  const prefix = [{ id: 'old', symbol: 'AAA', side: 'buy', qty: 10, timestamp: '2026-10-25T14:00:00Z' }]
  const seed = openingPositions([...prefix, ...prefix, { id: 'future', symbol: 'AAA', side: 'sell', qty: 10, timestamp: '2026-10-26T14:01:00Z' }], '2026-10-26T14:00:00Z')
  assert.equal(seed.AAA, 10)
  const rows = positionCycles([
    { id: 'close', symbol: 'AAA', side: 'sell', qty: 10, timestamp: '2026-10-26T14:01:00Z' },
    { id: 'open', symbol: 'AAA', side: 'buy', qty: 3, timestamp: '2026-10-26T14:02:00Z' }
  ], seed)
  assert.deepEqual(rows.map(row => [row.action, row.cycle]), [['Uscita', 1], ['Ingresso', 2]])
})
