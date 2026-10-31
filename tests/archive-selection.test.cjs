const { test } = require('node:test')
const assert = require('node:assert/strict')
test('initial selection is the last uninterrupted group, including adjacent sessions', async () => {
  const { latestContinuousWindows, recordingGaps } = await import('../src/bt/utils/archiveSelection.mjs')
  const windows = [{ id: 1, start_ns: 0, end_ns: 60e9 }, { id: 2, start_ns: 4000e9, end_ns: 5000e9 }, { id: 3, start_ns: 5001e9, end_ns: 6000e9 }]
  assert.deepEqual(latestContinuousWindows(windows), [2, 3])
  assert.deepEqual(latestContinuousWindows([]), [])
  assert.deepEqual(recordingGaps(windows), [{ from: 60000, to: 4000000 }])
})
test('simulation markers require actual price and unambiguous execution time', async () => {
  const { simulationMarkers } = await import('../src/bt/utils/executionMarkers.mjs')
  const trades = [
    { asset: 'AAPL', entry_side: 'long', size: 2, open_datetime: '2026-07-14T13:30:00Z', price: 100, close_datetime: '2026-07-14T13:31:00Z', exit_price: 101 },
    { asset: 'AAPL', open_datetime: '2026-07-14 00:00:00', price: 100, close_datetime: '2026-07-14T13:31:00Z', pnl: 2 },
    { asset: 'MSFT', open_datetime: '2026-07-14T13:30:00Z', price: 200 },
  ]
  const result = simulationMarkers(trades, 'AAPL', 0, Infinity)
  assert.equal(result.missing, 2)
  assert.deepEqual(result.markers.map(row => [row.side, row.price, row.source]), [['buy', 100, 'simulation'], ['sell', 101, 'simulation']])
})
