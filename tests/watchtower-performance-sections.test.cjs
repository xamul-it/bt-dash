const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/WatchtowerCronMonitoring.vue'), 'utf8')

test('backtest history is available with a baseline even without footprint snapshots', () => {
  const section = source.match(/<!-- Performance vs storia -->([\s\S]*?)<!-- Alpaca vs baseline Backtrader -->/)
  assert.ok(section)
  assert.match(section[1], /v-if="!selectedBaseline"/)
  assert.doesNotMatch(section[1], /prePost\.pre|prePost\.post/)
})
