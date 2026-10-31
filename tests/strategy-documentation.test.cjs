const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const helper = import(pathToFileURL(path.join(__dirname, '../src/bt/utils/strategyDocumentation.mjs')))

test('OvernightAH parameter documentation moves to field help', async () => {
  const { strategyDocumentation } = await helper
  const source = fs.readFileSync(path.join(__dirname, '../../bt-core/strategies/overnight_ah.py'), 'utf8')
  const doc = source.match(/class OvernightAH[^]*?"""([^]*?)"""/)[1].trim()
  const parameters = [...doc.matchAll(/^    (\w+)\s*:\s*.+$/gm)].map(match => ({ name: match[1] }))
  const schema = strategyDocumentation({ description: doc, parameters })
  assert.match(schema.parameters.find(p => p.name === 'min_cash_per_trade').description, /Notional minimo per aprire una posizione\. Sotto soglia la entry viene\nsaltata\./)
  assert.ok(!schema.description.includes('min_cash_per_trade : float'))
  assert.ok(!schema.description.includes('Notional minimo per aprire'))
  assert.ok(schema.description.includes(doc.split('\n')[0]))
})

test('undocumented parameters and unrelated sections remain intact', async () => {
  const { strategyDocumentation } = await helper
  const schema = strategyDocumentation({
    description: 'Summary\n\nParameters\n----------\nflag : bool\n    Enable feature.\n\nNotes\n-----\nKeep notes.\nunknown : str\n    Keep unknown.',
    parameters: [{ name: 'flag' }, { name: 'period', default: 5 }],
  })
  assert.equal(schema.parameters[0].description, 'Enable feature.')
  assert.equal(schema.parameters[1].description, '')
  assert.match(schema.description, /Notes\n-----\nKeep notes/)
  assert.match(schema.description, /unknown : str\n    Keep unknown/)
  assert.ok(!schema.description.includes('Parameters'))
})

test('Max DD uses numeric values for sorting and formats missing values', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/BacktestingStudio.vue'), 'utf8')
  const body = source.match(/name: "max_drawdown",([^]*?)\n        \},/)[1]
  const column = new Function(`return ({${body}})`).call({ percent: value => value == null ? '—' : `${value}%` })
  assert.equal(column.field({ result: { performance: { max_drawdown_pct: -12.5 } } }), -12.5)
  assert.equal(column.field({}), null)
  assert.equal(column.format(0), '0%')
  assert.equal(column.format(null), '—')
  assert.equal(column.sortable, true)
})

test('parameter groups keep documentation from each declaring class', async () => {
  const { strategyDocumentation } = await helper
  const schema = strategyDocumentation({ parameters: [{ name: 'period', default: 10 }], parameter_groups: [
    { class_name: 'Child', description: 'period : int\n    Child documentation.', parameters: [{ name: 'period', default: 10 }] },
    { class_name: 'Parent', description: 'period : int\n    Parent documentation.', parameters: [{ name: 'period', default: 5 }] },
  ] })
  assert.equal(schema.parameter_groups[0].parameters[0].description, 'Child documentation.')
  assert.equal(schema.parameter_groups[1].parameters[0].description, 'Parent documentation.')
  assert.equal(schema.parameter_groups[1].parameters[0].default, 5)
})

test('unused marker belongs to subclass help while original help stays available', async () => {
  const { strategyDocumentation } = await helper
  const schema = strategyDocumentation({ parameter_groups: [
    { class_name: 'Child', parameters: [{ name: 'weight', description: 'unused: replaced by panel.' }] },
    { class_name: 'Parent', parameters: [{ name: 'weight', description: 'Original score weight.' }] },
  ] })
  assert.equal(schema.parameter_groups[0].parameters[0].unused, true)
  assert.equal(schema.parameter_groups[1].parameters[0].unused, true)
  assert.equal(schema.parameter_groups[1].parameters[0].description, 'Original score weight.')
})

test('effective active override keeps historical unused declarations editable', async () => {
  const { strategyDocumentation } = await helper
  const schema = strategyDocumentation({
    parameters: [{ name: 'weight', description: 'Active composite weight.' }],
    parameter_groups: [
      { class_name: 'Child', parameters: [{ name: 'weight', description: 'Active composite weight.' }] },
      { class_name: 'Parent', parameters: [{ name: 'weight', description: 'unused: original implementation.' }] },
    ],
  })
  assert.ok(schema.parameter_groups.every(group => !group.parameters[0].unused))
  assert.equal(schema.parameter_groups[1].parameters[0].description, 'unused: original implementation.')
})

test('prefix sections use class docs and preserve full field names', async () => {
  const { parameterSections, strategyDocumentation } = await helper
  for (const className of ['OvernightAH', 'OvernightAHFlatComposite']) {
    const file = className === 'OvernightAH' ? 'overnight_ah.py' : 'overnight_ah_flat_composite.py'
    const source = fs.readFileSync(path.join(__dirname, '../../bt-core/strategies', file), 'utf8')
    const doc = source.match(new RegExp(`class ${className}[^]*?"""([^]*?)"""`))[1]
    const parameters = [{ name: 'monthly_universe_file' }, { name: 'monthly_universe_flat_weights' }, { name: 'max_exposure' }]
    const sections = parameterSections({ description: doc, parameters })
    assert.equal(sections[0].title, 'monthly_universe')
    assert.ok(sections[0].description)
    assert.equal(sections[0].parameters[0].label, 'file')
    assert.equal(sections[0].parameters[0].name, 'monthly_universe_file')
    assert.equal(sections[1].parameters[0].label, 'max_exposure')
    assert.ok(!strategyDocumentation({ description: doc, parameters }).description.includes('Parameter Groups'))
  }
})

test('longest explicit prefix wins and groups without docs have no help', async () => {
  const { parameterSections } = await helper
  const sections = parameterSections({ description: 'Parameter Groups\n----------------\nrisk\n    General risk.\nrisk_overlay\n    Entry scaling.\nhedge\n', parameters: [
    { name: 'risk_overlay_mode' }, { name: 'risk_limit' }, { name: 'hedge_enabled' },
  ] })
  assert.deepEqual(sections.map(s => s.title), ['risk_overlay', 'risk', 'hedge'])
  assert.equal(sections[2].description, '')
  assert.equal(parameterSections({ parameters: [{ name: 'a_b' }] })[0].parameters[0].label, 'a_b')
})
