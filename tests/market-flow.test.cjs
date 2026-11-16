const assert = require('node:assert/strict')
const { test } = require('node:test')
test('bid ask remain separate from real trades and minute closes', async () => {
  const { marketPlot, eventKind } = await import('../src/bt/utils/marketFlow.mjs')
  const rows = [
    { timestamp: '2026-10-01T20:00:00Z', event_type: 'quote', bid_price: 100, ask_price: 101 },
    { timestamp: '2026-10-01T20:00:00.050Z', event_type: 'trade', price: 100.5 },
    { timestamp: '2026-10-01T20:00:00.100Z', event_type: 'quote', bid_price: 99, ask_price: 100 },
    { timestamp: '2026-10-01T20:01:00Z', close: 99.5 }
  ]
  const plot = marketPlot(rows)
  assert.equal(plot.ticks.length, 1)
  assert.equal(plot.bars.length, 1)
  assert.match(plot.bid, /H/)
  assert.equal(eventKind(rows[3]), 'bar')
  assert.equal(marketPlot([{ timestamp: 'invalid', price: 1 }]), null)
})
test('live buffers deduplicate sequences and reset across logger sessions', async () => {
  const { mergeLive } = await import('../src/bt/utils/marketFlow.mjs')
  assert.deepEqual(mergeLive([{ sequence: 1 }, { sequence: 2 }], [{ sequence: 2 }, { sequence: 3 }], false, 2).map(r => r.sequence), [2, 3])
  assert.deepEqual(mergeLive([{ sequence: 100 }], [{ sequence: 1 }], true).map(r => r.sequence), [1])
})
test('live plot has a fixed 60 second linear time scale regardless of event frequency', async () => {
  const { liveTickPlot, mergeLiveTicks } = await import('../src/bt/utils/marketFlow.mjs')
  const now = Date.parse('2026-10-01T20:16:13Z')
  const rows = [0, 15000, 59000].map((offset, i) => ({ symbol: 'MU', event_type: 'trade', timestamp: new Date(now - 60000 + offset).toISOString(), price: 100 + i }))
  const first = liveTickPlot(rows, now)
  assert.equal(first.end - first.start, 60000)
  assert.deepEqual(first.ticks.map(p => p.x), [160, 347.5, 897.5])
  const later = liveTickPlot(rows, now + 37000)
  assert.equal(later.start - first.start, 37000)
  assert.equal(later.ticks.length, 1)
  assert.equal(later.ticks[0].x, 435)
  const sampled = mergeLiveTicks([], [...rows, { ...rows[0], timestamp: new Date(now - 59950).toISOString(), price: 99 }], false, now)
  assert.equal(sampled.length, 3)
  assert.equal(sampled[0].price, 99)
})
test('live chart retains the last three received minute bars and replaces updates', async () => {
  const { mergeLiveTicks, liveTickPlot } = await import('../src/bt/utils/marketFlow.mjs')
  const now = Date.parse('2026-10-01T20:16:13Z')
  const bars = [4, 3, 2, 1].map((minutes, i) => ({ symbol: 'MU', event_type: 'bar', timeframe: 'intraday', timestamp: new Date(now - minutes * 60000).toISOString(), open: 100, high: 103, low: 99, close: 101, sequence: i + 1 }))
  let rows = mergeLiveTicks([], [...bars, { ...bars[3], close: 102, sequence: 10 }, { ...bars[3], symbol: 'NVDA', timeframe: 'daily' }], false, now)
  assert.equal(rows.length, 3)
  assert.equal(rows.at(-1).close, 102)
  rows = mergeLiveTicks(rows, [], false, now + 300000)
  const plot = liveTickPlot(rows, now + 300000)
  assert.equal(plot.bars.length, 3)
  assert.equal(plot.bars.at(-1).row.close, 102)
  assert.ok(plot.levels[0].price > 103 && plot.levels[4].price < 99)
  assert.equal(mergeLiveTicks(rows, [], true, now).length, 0)
  assert.equal(liveTickPlot(rows, now + 300000, { bars: false }).levels.length, 0)
})
test('forming candle uses every received trade and resets on the minute boundary', async () => {
  const { mergeTradeCandles, mergeLiveTicks, liveTickPlot } = await import('../src/bt/utils/marketFlow.mjs')
  const start = Date.parse('2026-10-01T20:16:00Z'), now = start + 20000
  const trade = (ms, price, sequence) => ({ symbol: 'MU', event_type: 'trade', timestamp: new Date(start + ms).toISOString(), price, sequence })
  const incoming = [trade(100, 100, 1), trade(120, 110, 2), trade(150, 101, 3), trade(50, 99, 4)]
  const candles = mergeTradeCandles([], incoming, false, now)
  assert.deepEqual([candles[0].open, candles[0].high, candles[0].low, candles[0].close], [99, 110, 99, 101])
  assert.equal(mergeLiveTicks([], incoming, false, now).length, 2)
  const plot = liveTickPlot([], now, { provisional: true }, candles[0])
  assert.equal(plot.provisional.row.high, 110)
  assert.ok(plot.levels[0].price > 110)
  assert.equal(liveTickPlot([], start + 60000, { provisional: true }, candles[0]).levels.length, 0)
  assert.deepEqual(mergeTradeCandles(candles, [], false, start + 60000), [])
  assert.deepEqual(mergeTradeCandles(candles, [], true, now), [])
})

test('live chart shows the latest older quote as a marked reference without inventing updates', async () => {
  const { liveTickPlot } = await import('../src/bt/utils/marketFlow.mjs')
  const now = Date.parse('2026-11-16T21:17:50Z')
  const last = { symbol: 'CMCSA', event_type: 'quote', timestamp: '2026-11-16T21:13:39Z', bid_price: 25.56, ask_price: 25.71 }
  const plot = liveTickPlot([], now, undefined, null, last)
  assert.equal(plot.staleQuote, true)
  assert.match(plot.bid, /^M160,.*H910$/)
  assert.match(plot.ask, /^M160,.*H910$/)
  const recent = { ...last, timestamp: '2026-11-16T21:17:40Z', bid_price: 25.6 }
  const updated = liveTickPlot([recent], now, undefined, null, last)
  assert.equal(updated.staleQuote, false)
  assert.notEqual(updated.bid, plot.bid)
  assert.equal(liveTickPlot([], now, undefined, null, { ...last, timestamp: '2026-11-16T21:18:00Z' }).bid, '')
})

test('out of sequence trades cannot appear as ticks or contaminate candles or sampled buckets', async () => {
  const { isOutOfSequenceTrade, mergeTradeCandles, mergeLiveTicks, liveTickPlot } = await import('../src/bt/utils/marketFlow.mjs')
  const now = Date.parse('2026-11-16T21:27:18.700Z')
  const valid = { symbol: 'NVDA', event_type: 'trade', timestamp: '2026-11-16T21:27:18.510Z', price: 156.5, sequence: 1, conditions: ['@', 'T', 'I'] }
  const late = { ...valid, timestamp: '2026-11-16T21:27:18.590Z', price: 183.91, sequence: 2, conditions: ['@', 'Z', 'I'] }
  const extendedLate = { ...late, sequence: 3, conditions: ['U'] }
  assert.equal(isOutOfSequenceTrade(late), true)
  assert.equal(isOutOfSequenceTrade(extendedLate), true)
  assert.equal(isOutOfSequenceTrade(valid), false)
  assert.equal(isOutOfSequenceTrade({ ...late, event_type: 'quote' }), false)
  const sampled = mergeLiveTicks([], [valid, late], false, now)
  assert.deepEqual(sampled.map(row => row.price), [156.5])
  assert.equal(mergeTradeCandles([], [valid, late, extendedLate], false, now)[0].high, 156.5)
  assert.deepEqual(liveTickPlot([valid, late], now).ticks.map(tick => tick.price), [156.5])
})
