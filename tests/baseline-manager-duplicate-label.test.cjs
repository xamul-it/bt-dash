const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/ProfileBaselineManager.vue'), 'utf8')

test('baseline manager blocks an existing label before starting a costly backtest', () => {
  assert.match(source, /:error="duplicateLabel"/)
  assert.match(source, /!this\.duplicateLabel/)
  assert.match(source, /this\.baselines\.some\(\(row\) => String\(row\.label \|\| ''\) === label\)/)
})
