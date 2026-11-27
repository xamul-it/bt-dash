const { test } = require('node:test')
const assert = require('node:assert/strict')

test('closed market explains only uncommunicated no-order decisions', async () => {
  const { normalClosedMarketDay } = await import('../src/bt/utils/watchtowerMarketClosure.mjs')
  const day = '2026-11-26'
  const calendar = { covered_months: ['2026-11'], days: { '2026-11-25': {}, '2026-11-27': {} } }
  const receipt = { run_status: 'completed', outcome: null, orders: [], reasons: [] }
  const item = { decisions: { backtest: receipt, alpaca: receipt }, comparison: {
    status: 'error', diffs: [{ kind: 'decision_not_communicated', source: 'backtest' }, { kind: 'decision_not_communicated', source: 'alpaca' }]
  } }
  assert.equal(normalClosedMarketDay(day, item, calendar), true)
  assert.equal(normalClosedMarketDay('2026-11-27', item, calendar), false)
  assert.equal(normalClosedMarketDay(day, item, {}), false)
  assert.equal(normalClosedMarketDay(day, { ...item, decisions: { ...item.decisions, alpaca: { ...receipt, run_status: 'failed' } } }, calendar), false)
  assert.equal(normalClosedMarketDay(day, { ...item, alpacaActivity: [{}] }, calendar), false)
  assert.equal(normalClosedMarketDay(day, { ...item, decisions: { ...item.decisions, alpaca: { ...receipt, reasons: [{ code: 'cooldown' }] } } }, calendar), false)
  assert.equal(normalClosedMarketDay(day, { ...item, comparison: { status: 'error', diffs: [{ kind: 'run_failed' }] } }, calendar), false)
  assert.equal(normalClosedMarketDay(day, { ...item, settlements: { alpaca: [{}] } }, calendar), false)
})
