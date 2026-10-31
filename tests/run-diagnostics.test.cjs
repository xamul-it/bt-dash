const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const file = fs.readFileSync(path.join(__dirname, '../src/bt/components/RunDiagnostics.vue'), 'utf8')
const script = file.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '').replace('export default', 'return')
function context(api, run = { id: 'first', done: true }) {
  const component = new Function('api', 'BaselineComparison', 'DailyReconciliationTable', 'returnColor', script)(api, {}, {}, () => '')
  return { ...component.data(), ...component.methods, run, endpoint: '/sim' }
}

test('switching run ignores an older diagnostics response', async () => {
  const pending = []
  const ctx = context({ get: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) })
  const first = ctx.load()
  ctx.run = { id: 'second', done: true }
  const second = ctx.load()
  assert.equal(pending[1].url, '/sim/jobs/second/diagnostics')
  assert.equal(pending[1].options.params.history_days, 25)
  pending[1].resolve({ data: { id: 'second' } })
  await second
  pending[0].resolve({ data: { id: 'first' } })
  await first
  assert.equal(ctx.data.id, 'second')
  assert.equal(ctx.loading, false)
})

test('unfinished runs do not request artifacts; missing artifacts surface an error', async () => {
  let calls = 0
  const ctx = context({ get: async () => { calls++; throw { response: { data: { error: 'Artefatto mancante' } } } } }, { id: 'pending', done: false })
  await ctx.load()
  assert.equal(calls, 0)
  ctx.run.done = true
  ctx.data = { old: true }
  await ctx.load()
  assert.equal(calls, 1)
  assert.equal(ctx.data, null)
  assert.equal(ctx.error, 'Artefatto mancante')
  assert.equal(ctx.loading, false)
})
