const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/BacktestingStudio.vue'), 'utf8')
test('run list excludes benchmark updates and respects archive and deletion', () => {
  const filtered = new Function(source.match(/    filteredRuns\(\) \{([\s\S]*?)\n    \},/)[1])
  const run = (id, kind = 'simulation', archive = {}) => ({ id, kind, archive })
  const context = { jobs: [run('visible'), run('archived', 'simulation', { hidden: true }), run('deleted', 'simulation', { deleted_at: 'now' }), run('benchmark', 'market_data_refresh')], showHidden: false, pinnedOnly: false, search: '', runLabel: row => row.id }
  assert.deepEqual(filtered.call(context).map(row => row.id), ['visible'])
  context.showHidden = true
  assert.deepEqual(filtered.call(context).map(row => row.id), ['visible', 'archived'])
})
test('leverage filter uses saved broker values and combines with existing filters', () => {
  const filtered = new Function(source.match(/    filteredRuns\(\) \{([\s\S]*?)\n    \},/)[1])
  const options = new Function(source.match(/    leverageOptions\(\) \{([\s\S]*?)\n    \},/)[1])
  const run = (id, leverage, archive = {}, kind = 'simulation') => ({ id, kind, archive, request_snapshot: { configuration: { broker: { margin_leverage: leverage } } } })
  const context = { jobs: [run('one', 1), run('two', '2', { pinned: true }), run('ten', 10), run('duplicate', 2), run('missing'), run('invalid', 'unknown'), run('hidden', 3, { hidden: true }), run('deleted', 4, { deleted_at: 'now' }), run('benchmark', 5, {}, 'market_data_refresh')], leverageFilter: null, showHidden: false, pinnedOnly: false, search: '', runLabel: row => row.id }
  assert.deepEqual(options.call(context), [1, 2, 3, 10])
  assert.equal(filtered.call(context).length, 6)
  context.leverageFilter = 2
  assert.deepEqual(filtered.call(context).map(r => r.id), ['two', 'duplicate'])
  context.pinnedOnly = true
  assert.deepEqual(filtered.call(context).map(r => r.id), ['two'])
  context.search = 'one'
  assert.deepEqual(filtered.call(context), [])
  context.search = ''; context.pinnedOnly = false; context.leverageFilter = 3; context.showHidden = true
  assert.deepEqual(filtered.call(context).map(r => r.id), ['hidden'])
  context.leverageFilter = null
  assert.ok(filtered.call(context).some(r => r.id === 'missing'))
})
