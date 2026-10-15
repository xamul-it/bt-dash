const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/ProfileBaselineManager.vue'), 'utf8')
function method(name) {
  const match = source.match(new RegExp(`    ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\},`))
  assert.ok(match, name)
  return new Function('constants', `return function(${match[1]}) {${match[2]}\n}`)({ API_BASE_URL: '/api' })
}

test('baseline details use saved execution values rather than current profile settings', () => {
  const row = { params: { max_exposure: 1, post_up_cooldown_threshold: 0.01, post_up_cooldown_days: 5 },
    effective_params: { max_exposure: 2, post_up_cooldown_threshold: 0, post_up_cooldown_days: 0 },
    run_config: { margin_leverage: 2 }, result_snapshot: { input_margin_leverage: 1 } }
  assert.equal(method('runValue')(row, 'margin_leverage'), 2)
  assert.equal(method('exposureValue')(row), 2)
  assert.equal(method('cooldownValue')(row), 'disattivato')
  assert.equal(method('runValue')({}, 'margin_leverage'), 'n/d')
  assert.equal(method('cooldownValue')({}), 'n/d')
})

test('report link identifies the saved baseline and uses the authenticated API', () => {
  const row = { id: 108, profile: 'challenger',
    strategy: 'overnight_ah_flat_composite.OvernightAHFlatComposite', run_id: 'baseline_challenger_test' }
  assert.equal(method('statsUrl')(row), '/api/dyn/obs/watchtower/cron/challenger/baselines/108/stats.html')
  assert.equal(method('statsUrl')({ ...row, run_id: '../outside' }), '')
  assert.equal(method('statsUrl')({ ...row, run_id: null }), '')
})
