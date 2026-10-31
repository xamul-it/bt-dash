const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const definitions = new Function(read('src/bt/utils/statisticalIndicatorHelp.js').replace('export default', 'return'))()
const script = read('src/bt/components/BaselineComparison.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '').replace('export default', 'return')
const component = new Function('HistoricalCoherence', 'BalancePersistence', 'StatisticalHelp', 'compatibilityMethods', 'returnColor', script)({}, {}, {}, {}, () => '')
const ongoing = windows => component.computed.ongoingSequence.call({ windows })
const window = value => ({ comparison: { recent: { balance_persistence: value } } })

test('every statistical study explains its purpose, calculation and limitations', () => {
  for (const kind of ['compatibility', 'continuous', 'balance', 'persistence', 'ongoing']) {
    const help = definitions[kind]
    assert.ok(help.title && help.purpose && help.details.length && help.formulas.length)
  }
  assert.match(definitions.compatibility.formulas.join(' '), /σ₀ \/ √n/)
  assert.match(definitions.compatibility.details.join(' '), /trade indipendenti/)
  assert.match(definitions.compatibility.details.join(' '), /comprende anche i trade delle finestre finali/)
  for (const kind of ['continuous', 'balance', 'persistence']) {
    const text = definitions[kind].details.join(' ')
    assert.match(text, /almeno 20 blocchi/)
    assert.match(text, /non è la probabilità/)
    assert.match(text, /senza assumere giornate indipendenti/)
    assert.match(text, /non sovrapposti/)
  }
  assert.match(definitions.balance.formulas.join(' '), /rₜ < μ/)
  assert.match(definitions.persistence.formulas.join(' '), /Lₜ₋₁ \+ 1/)
  assert.match(definitions.ongoing.details.join(' '), /Non significa che non ci siano state perdite/)
})

test('one ongoing summary accepts zero, exceeds windows and survives missing columns', () => {
  const value = { status: 'available', threshold_mean: .001, recent_end: '2026-10-23', ongoing_negative_days: 0, ongoing_below_mean_days: 42 }
  const windows = [window(null), window({ status: 'unavailable' }), window(value), window(value)]
  assert.equal(ongoing(windows), value)
  assert.equal(ongoing(windows).ongoing_negative_days, 0)
  assert.equal(ongoing(windows).ongoing_below_mean_days, 42)
  for (const bad of [null, {}, { ...value, status: 'unavailable' }, { ...value, threshold_mean: null },
    { ...value, ongoing_negative_days: null }, { ...value, ongoing_below_mean_days: -1 },
    { ...value, recent_end: null }]) assert.equal(ongoing([window(bad)]), null)
  assert.equal(ongoing([]), null)
})
