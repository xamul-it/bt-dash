const { test } = require('node:test')
const assert = require('node:assert/strict')
const sessions = import('../src/bt/utils/portfolioSessions.mjs')
const points = (...times) => times.map(time => ({ time: Date.parse(time) / 1000, value: 100 }))
const seconds = value => Date.parse(value) / 1000
const calendar = { covered_months: ['2026-07', '2026-11', '2026-12'], days: {
  '2026-07-14': { pm: seconds('2026-07-14T08:00Z'), rth: seconds('2026-07-14T13:30Z'), ah: seconds('2026-07-14T20:00Z'), close: seconds('2026-07-15T00:00Z') },
  '2026-07-20': { pm: seconds('2026-07-20T08:00Z'), rth: seconds('2026-07-20T13:30Z'), ah: seconds('2026-07-20T20:00Z'), close: seconds('2026-07-21T00:00Z') },
  '2026-11-27': { pm: seconds('2026-11-27T09:00Z'), rth: seconds('2026-11-27T14:30Z'), ah: seconds('2026-11-27T18:00Z'), close: seconds('2026-11-27T22:00Z') },
  '2026-12-14': { pm: seconds('2026-12-14T09:00Z'), rth: seconds('2026-12-14T14:30Z'), ah: seconds('2026-12-14T21:00Z'), close: seconds('2026-12-15T01:00Z') }
} }

test('boundaries use calendar timestamps in summer and winter', async () => {
  const { sessionBoundaries } = await sessions
  for (const [before, after] of [['2026-07-14T13:25Z', '2026-07-14T13:30Z'], ['2026-12-14T14:25Z', '2026-12-14T14:30Z']]) {
    assert.deepEqual(sessionBoundaries(points(before, after), '5Min', calendar), [{ logical: 1, label: 'RTH' }])
  }
})

test('holiday and weekend remain closed with no fabricated boundaries', async () => {
  const { sessionShading, sessionBoundaries } = await sessions
  const samples = points('2026-11-26T14:25Z', '2026-11-26T14:30Z', '2026-11-26T21:00Z', '2026-07-18T08:00Z')
  assert.deepEqual(sessionShading(samples, '5Min', calendar), ['C', 'C', 'C', 'C'])
  assert.deepEqual(sessionBoundaries(samples.slice(0, 3), '5Min', calendar), [])
})

test('early close starts AH at 13 and ends it at 17 New York', async () => {
  const { sessionShading, sessionBoundaries } = await sessions
  const samples = points('2026-11-27T17:55Z', '2026-11-27T18:00Z', '2026-11-27T21:55Z', '2026-11-27T22:00Z')
  assert.deepEqual(sessionShading(samples, '5Min', calendar), ['RTH', 'AH', 'AH', 'C'])
  assert.deepEqual(sessionBoundaries(samples, '5Min', calendar), [{ logical: 1, label: 'AH' }, { logical: 3, label: 'C' }])
})

test('missing calendar is unknown, not closed or regular', async () => {
  const { sessionShading, sessionBoundaries } = await sessions
  const samples = points('2026-10-05T13:25Z', '2026-10-05T13:30Z')
  assert.deepEqual(sessionShading(samples, '5Min', calendar), ['UNKNOWN', 'UNKNOWN'])
  assert.deepEqual(sessionBoundaries(samples, '5Min', calendar), [])
  assert.deepEqual(sessionShading(samples, '1D', calendar), [])
})

test('compressed overnight gap shows the next session start', async () => {
  const { sessionBoundaries } = await sessions
  const samples = points('2026-07-14T23:55Z', '2026-07-15T00:00Z', '2026-07-20T08:00Z', '2026-07-20T08:05Z')
  assert.deepEqual(sessionBoundaries(samples, '5Min', calendar), [{ logical: 2, label: 'PM' }])
})


test('overnight follows the next trading day, including Sunday and holidays', async () => {
  const { sessionShading, sessionBoundaries, standardPortfolioPoints } = await sessions
  const samples = points('2026-07-19T23:55Z', '2026-07-20T00:00Z', '2026-07-20T07:55Z', '2026-07-20T08:00Z')
  assert.deepEqual(sessionShading(samples, '5Min', calendar), ['C', 'OH', 'OH', 'PM'])
  assert.deepEqual(sessionBoundaries(samples.slice(0, 2), '5Min', calendar), [{ logical: 1, label: 'OH' }])
  assert.equal(standardPortfolioPoints(samples.map(p => ({ timestamp: new Date(p.time * 1000).toISOString() })), '5Min', calendar).length, 3)
  assert.deepEqual(sessionShading(points('2026-11-26T01:00Z', '2026-11-27T01:00Z'), '5Min', calendar), ['C', 'OH'])
})

test('unknown calendar preserves standard samples and daily data is untouched', async () => {
  const { standardPortfolioPoints } = await sessions
  const samples = [{ timestamp: '2026-10-05T12:00:00Z' }]
  assert.deepEqual(standardPortfolioPoints(samples, '5Min', calendar), samples)
  assert.deepEqual(standardPortfolioPoints(samples, '1D', calendar), samples)
})
