const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/SimulationBenchmarks.vue'), 'utf8')

test('editing a benchmark preserves its identity and schedule while exposing the start date', () => {
  const edit = new Function('row', source.match(/    editDefinition\(row\) \{([\s\S]*?)\n    \},/)[1])
  const row = { id: 'buyhold', ticker: 'list.json', fromdate: '2000-01-01', hour: 4, minute: 25, enabled: true }
  const context = { managed: {} }
  global.window = { scrollTo() {} }
  try { edit.call(context, row) } finally { delete global.window }
  assert.deepEqual(context.managed, row)
  context.managed.fromdate = '1998-01-01'
  assert.equal(row.fromdate, '2000-01-01')
  assert.match(source, /Storico richiesto da \{\{ definition.fromdate \}\}/)
  assert.doesNotMatch(source, /label="(?:Ora|Minuti)"/)
})
