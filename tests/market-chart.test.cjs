const { test } = require('node:test')
const assert = require('node:assert/strict')
test('financial market series sort and deduplicate each channel independently', async () => {
  const { marketSeries } = await import('../src/bt/utils/marketChart.mjs')
  const data = marketSeries([
    { time: 2, event_type: 'quote', bid_price: 100, ask_price: 101 },
    { time: 1, event_type: 'quote', bid_price: 99, ask_price: 100 },
    { time: 2, event_type: 'quote', bid_price: 100.5, ask_price: 101.5 },
    { time: 2, event_type: 'trade', price: 101 },
    { time: 3, event_type: 'bar', open: 100, high: 102, low: 99, close: 101 }
  ])
  assert.deepEqual(data.bid, [{ time: 1, value: 99 }, { time: 2, value: 100.5 }])
  assert.equal(data.trades.length, 1)
  assert.equal(data.bars[0].close, 101)
})
test('market series reject invalid timestamps and do not invent OHLC bars', async () => {
  const { marketSeries } = await import('../src/bt/utils/marketChart.mjs')
  const data = marketSeries([{ timestamp: 'invalid', event_type: 'trade', price: 1 }, { time: 1, close: 10 }])
  assert.deepEqual(data, { bid: [], ask: [], trades: [], bars: [] })
})

test('chart filters out-of-sequence trades when conditions are available', async () => {
  const { marketSeries } = await import('../src/bt/utils/marketChart.mjs')
  const data = marketSeries([
    { time: 1, event_type: 'trade', price: 100, conditions: ['@'] },
    { time: 2, event_type: 'trade', price: 185, conditions: ['@', 'Z', 'I'] },
    { time: 3, event_type: 'trade', price: 184, conditions: ['U'] },
    { time: 4, event_type: 'trade', price: 101 }
  ])
  assert.deepEqual(data.trades.map(row => row.value), [100, 101])
})
