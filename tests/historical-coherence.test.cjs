const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/components/HistoricalCoherence.vue'), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', 'return')
const component = new Function(script)()
function context(value, comparisonKind = 'continuous') {
  const ctx = { value, comparisonKind, unavailableReason: component.props.unavailableReason.default }
  for (const [name, getter] of Object.entries(component.computed)) {
    Object.defineProperty(ctx, name, { get: () => getter.call(ctx) })
  }
  return ctx
}

test('zero historical precedents is rare, not missing data or a zero probability', () => {
  const ctx = context({ status: 'very_few_precedents', historical_blocks: 100, tail_blocks: 0,
    historical_start: '2010-01-01', historical_end: '2018-12-31' })
  assert.equal(ctx.available, true)
  assert.equal(ctx.state.color, 'negative')
  assert.match(ctx.description, /0 su 100/)
  assert.match(ctx.description, /non misura la probabilità/)
  assert.match(ctx.description, /controlli ripetuti/)
})

test('missing series, failed calculation and inconsistent counts remain unavailable', () => {
  for (const value of [null, {}, { status: 'many_precedents', historical_blocks: 100, tail_blocks: null },
    { status: 'many_precedents', historical_blocks: 10, tail_blocks: 2 },
    { status: 'many_precedents', historical_blocks: 100, tail_blocks: 101 }]) {
    const ctx = context(value)
    assert.equal(ctx.available, false)
    assert.equal(ctx.state.label, 'Non valutabile')
  }
  const ctx = context({ status: 'unavailable', reason: 'Storico incompleto' })
  assert.equal(ctx.description, 'Storico incompleto')
})

test('ordinary and intermediate historical comparisons have distinct labels', () => {
  assert.equal(context({ status: 'many_precedents', historical_blocks: 100, tail_blocks: 50 }).state.label, 'Molti precedenti')
  assert.equal(context({ status: 'few_precedents', historical_blocks: 100, tail_blocks: 10 }).state.color, 'orange-9')
})

test('category comparisons explain historical thresholds and avoid independent coin assumptions', () => {
  const value = { status: 'many_precedents', historical_blocks: 100, tail_blocks: 50,
    threshold_mean: 0, threshold_reference_start: '2000-01-01', reference_end: '2019-12-31',
    historical_start: '2004-01-01', historical_end: '2019-12-31',
    baseline_fractions: { negative: .3, zero: .2, positive: .5, below_mean: .3 } }
  const balance = context(value, 'balance').description
  assert.match(balance, /riferimento: 0%/i)
  assert.match(balance, /zeri sono distinti dalle perdite/)
  assert.match(balance, /negative 30%, zero 20%, positive 50%, sotto media 30%/)
  assert.match(balance, /senza assumere giornate indipendenti/)
  assert.match(balance, /Non sono soglie validate/)
  const persistence = context(value, 'persistence').description
  assert.match(persistence, /lunghezza massima e finale/)
  assert.match(persistence, /coppie consecutive/)
  assert.match(persistence, /soltanto le N sedute/)
})
