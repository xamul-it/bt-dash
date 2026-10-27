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
