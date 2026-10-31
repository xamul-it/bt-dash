const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/components/BalancePersistence.vue'), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '').replace('export default', 'return')
const component = new Function('HistoricalCoherence', script)({})
function context(value, kind = 'balance') {
  const ctx = { value, kind }
  for (const [name, getter] of Object.entries(component.computed)) {
    Object.defineProperty(ctx, name, { get: () => getter.call(ctx) })
  }
  return ctx
}
const value = {
  status: 'available', window_days: 20, threshold_mean: .001234567,
  recent: { negative_days: 8, zero_days: 3, positive_days: 9, below_mean_days: 12,
    longest_negative_run: 4, longest_below_mean_run: 5 },
  balance: { status: 'many_precedents', tail_blocks: 50, historical_blocks: 100 },
  persistence: { status: 'very_few_precedents', tail_blocks: 0, historical_blocks: 100 },
}
test('frequencies and sequences retain separate historical comparisons', () => {
  const balance = context(value)
  const persistence = context(value, 'persistence')
  assert.equal(balance.available, true)
  assert.equal(balance.rankValue.status, 'many_precedents')
  assert.equal(persistence.rankValue.status, 'very_few_precedents')
  assert.equal(persistence.rankValue.tail_blocks, 0)
  assert.equal(balance.meanLabel, '+0,1235')
  assert.equal(context({ ...value, threshold_mean: 0 }).meanLabel, '+0')
  assert.equal(context({ ...value, threshold_mean: -.001 }).meanLabel, '-0,1')
})
test('missing or inconsistent daily counts never become a meaningful indicator', () => {
  for (const missing of [null, {}, { status: 'unavailable', reason: 'Storico breve' },
    { ...value, threshold_mean: null },
    { ...value, recent: { ...value.recent, zero_days: 0 } },
    { ...value, recent: { ...value.recent, longest_negative_run: 21 } }]) {
    const ctx = context(missing)
    assert.equal(ctx.available, false)
    assert.equal(ctx.rankValue.status, 'unavailable')
    assert.equal(ctx.meanLabel, '—')
  }
})
