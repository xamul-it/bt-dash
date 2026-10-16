const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/WatchtowerCronMonitoring.vue'), 'utf8')

test('cron banner shows only the first history row summary and expansion hint', () => {
  const banner = source.match(/<q-banner :class="statusBannerClass"[\s\S]*?<\/q-banner>/)[0]
  assert.match(banner, /latestActivity\.trading_date/)
  assert.match(banner, /latestActivity\.detail \|\| latestActivity\.statusLabel/)
  assert.match(banner, /Apri la riga corrispondente/)
  assert.doesNotMatch(banner, /statusHeadline|statusSubline|resultDetail/)
  assert.match(source, /latestActivity\(\) \{\s*return this\.reconciliationRows\[0\] \|\| null/)
  assert.doesNotMatch(source, /In attesa di riconciliazione:|Da analizzare nello storico:|Sono divergenze\/esiti da verificare/)
})

function computed(name) {
  return new Function(source.match(new RegExp(`    ${name}\\(\\) \\{([\\s\\S]*?)\\n    \\},`))[1])
}

test('banner color and icon follow the current row, not historical pending or other checks', () => {
  const context = { latestActivity: { badgeColor: 'positive' }, pendingCount: 8,
    statusHeadline: 'Ultimo ingresso coerente · arretrati da recuperare',
    overview: { open_guardrail_alerts: [{}], latest_drift_check: { status: 'warning' } } }
  assert.equal(computed('statusBannerClass').call(context), 'bg-positive')
  assert.equal(computed('statusIcon').call(context), 'check_circle')
  context.latestActivity.badgeColor = 'negative'
  assert.equal(computed('statusBannerClass').call(context), 'bg-negative')
  assert.equal(computed('statusIcon').call(context), 'error')
  context.latestActivity.badgeColor = 'orange'
  assert.equal(computed('statusBannerClass').call(context), 'bg-orange text-dark')
  assert.equal(computed('statusIcon').call(context), 'warning')
  context.latestActivity = null
  assert.equal(computed('statusBannerClass').call(context), 'bg-grey-7')
  assert.equal(computed('statusIcon').call(context), 'info')
})
