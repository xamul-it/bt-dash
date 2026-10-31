const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/utils/baselineCompatibility.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src/bt/components/BaselineComparison.vue'), 'utf8')
const methods = {}
for (const name of ['compatibilityDelta', 'compatibilityColor', 'compatibilityDirectionText', 'compatibilityLabel', 'normalTwoSidedProbability', 'pct']) {
  const match = source.match(new RegExp(`    ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\},`))
  assert.ok(match, name)
  methods[name] = new Function(match[1], match[2])
}
function context(mean = 0.1) {
  return { ...methods, selectedBaseline: { metrics: { mean, stddev: 1.5 } } }
}
function comparison(mean) { return { recent: { metrics: { mean }, sample_size: 50 } } }

test('colors indicate gain direction and include both neutral boundaries', () => {
  const ctx = context()
  for (const mean of [0.09, 0.1, 0.11]) assert.equal(ctx.compatibilityColor(comparison(mean)), 'text-grey-7')
  assert.equal(ctx.compatibilityColor(comparison(0.110001)), 'text-positive')
  assert.equal(ctx.compatibilityColor(comparison(0.089999)), 'text-negative')
})
test('missing observations are neutral and never treated as zero gain', () => {
  const ctx = context()
  for (const item of [null, comparison(null), comparison(undefined), comparison(NaN)]) {
    assert.equal(ctx.compatibilityColor(item), 'text-grey-7')
    assert.equal(ctx.compatibilityLabel(item), '—')
  }
  assert.equal(ctx.compatibilityDelta(comparison(0)), -0.1)
})
test('low compatibility can be green and tooltips explain direction and threshold', () => {
  const ctx = context()
  const item = comparison(0.4)
  assert.equal(ctx.compatibilityColor(item), 'text-positive')
  assert.ok(parseFloat(ctx.compatibilityLabel(item)) < 30)
  assert.match(ctx.compatibilityDirectionText(item), /superiore.*\+0\.300000.*±0,01/)
  assert.match(ctx.compatibilityDirectionText(comparison(0.08)), /inferiore.*-0\.020000/)
})
