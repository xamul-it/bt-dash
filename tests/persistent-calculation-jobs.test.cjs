const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = name => fs.readFileSync(path.join(__dirname, `../src/bt/pages/${name}`), 'utf8')

test('Watchtower confirms the exact 25 sessions and recovers persistent monitoring', () => {
  const source = read('WatchtowerCronMonitoring.vue')
  assert.match(source, /Ricalcola ultime 25 giornate/)
  assert.match(source, /backtest-rebuild\/preview/)
  assert.match(source, /replace_backtest: true/)
  assert.match(source, /preview\.dates\.join/)
  assert.match(source, /\/dyn\/sc\/calculations/)
  assert.match(source, /beforeUnmount\(\)[\s\S]*stopCalculationPolling/)
  assert.match(source, /Errore di monitoraggio/)
})

test('Baseline Manager and Scheduler show recovered jobs without timer controls', () => {
  const manager = read('ProfileBaselineManager.vue')
  const scheduler = read('Scheduler.vue')
  assert.match(manager, /recoverJob/)
  assert.match(manager, /\/dyn\/sc\/calculations/)
  assert.match(scheduler, /Esecuzioni persistenti/)
  assert.match(scheduler, /openCalculationOutput/)
  assert.doesNotMatch(scheduler, /pauseCalculation|resumeCalculation/)
})
