const { test } = require('node:test')
const assert = require('node:assert/strict')
test('requested history does not conceal late listings and stale constituents', async () => {
  const { benchmarkLimits } = await import('../src/bt/utils/benchmarkCoverage.mjs')
  const limits = benchmarkLimits([
    { symbol: 'ARM', available: true, first_bar: '2023-09-14 00:00:00+00:00', last_bar: '2026-10-23' },
    { symbol: 'EA', available: true, first_bar: '2000-01-03', last_bar: '2026-08-10' },
    { symbol: 'AAPL', available: true, first_bar: '2000-01-03', last_bar: '2026-10-23' },
    { symbol: 'MISSING', available: false },
  ], { first_date: '2023-09-14', last_date: '2026-08-10' })
  assert.deepEqual(limits, { start: ['ARM'], end: ['EA'], missing: ['MISSING'] })
})
test('advanced local data are not reported as the old published limits', async () => {
  const { benchmarkLimits } = await import('../src/bt/utils/benchmarkCoverage.mjs')
  assert.deepEqual(benchmarkLimits([{ symbol: 'EA', available: true, first_bar: '2000-01-03', last_bar: '2026-10-23' }], { first_date: '2023-09-14', last_date: '2026-08-10' }), { start: [], end: [], missing: [] })
})
