const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/BacktestingStudio.vue'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const body = source.match(/    async refreshBenchmarks\(\) \{([\s\S]*?)\n    \},/)[1]

test('opening the benchmark combo refreshes saved runs without resetting the strategy', async () => {
  const rows = [{ name: 'saved_new', label: 'development', available: true, source_type: 'run' }]
  let calls = 0
  const refresh = new AsyncFunction('api', 'endpoint', body)
  const context = { loadingBenchmarks: false, catalog: { benchmarks: [] }, form: { strategy: 'Test', benchmark: 'old' } }
  await refresh.call(context, { get: async url => { calls++; assert.equal(url, '/dyn/simulations/benchmarks'); return { data: rows } } }, '/dyn/simulations')
  assert.equal(calls, 1)
  assert.deepEqual(context.catalog.benchmarks, rows)
  assert.deepEqual(context.form, { strategy: 'Test', benchmark: 'old' })
  const options = new Function(source.match(/    benchmarkOptions\(\) \{([\s\S]*?)\n    \},/)[1])
  assert.deepEqual(options.call(context), [{ label: 'development', value: 'saved_new' }])
  assert.equal(context.loadingBenchmarks, false)
  assert.match(source, /@filter="loadBenchmarkOptions"/)
})

test('failed refresh preserves the last list and releases the loading state', async () => {
  const context = { loadingBenchmarks: false, catalog: { benchmarks: ['existing'] }, message: e => e.message }
  await new AsyncFunction('api', 'endpoint', body).call(context, { get: async () => { throw new Error('offline') } }, '')
  assert.deepEqual(context.catalog.benchmarks, ['existing'])
  assert.equal(context.loadingBenchmarks, false)
  assert.equal(context.error, 'offline')
})

test('benchmark is visible beside the ticker universe and uses an independent configuration field', () => {
  const firstSection = source.slice(0, source.indexOf('2 · Parametri strategia'))
  assert.match(firstSection, /label="Universo ticker"/)
  assert.match(firstSection, /label="Benchmark"/)
  assert.match(firstSection, /v-model="form\.benchmark"/)
  const config = new Function(source.match(/    config\(\) \{([\s\S]*?)\n    \},/)[1])
  const context = { form: { ticker: 'universe.json', benchmark: 'saved_new' }, parameterInputs: {}, schema: {} }
  const payload = config.call(context)
  assert.equal(payload.ticker, 'universe.json')
  assert.equal(payload.benchmark, 'saved_new')
  assert.equal(payload.mode, 'backtest')
})
