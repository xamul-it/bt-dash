const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/LaboratorySchedules.vue'), 'utf8')
const dataSource = fs.readFileSync(path.join(__dirname, '../src/bt/pages/SimulationData.vue'), 'utf8')
test('dashboard contains only scheduled favorites and keeps history separate', async () => {
  const { scheduleForRun, newestRuns } = await import('../src/bt/utils/scheduledRuns.mjs')
  const computed = name => new Function('newestRuns', 'isDashboardFavorite', 'return function() {' + source.match(new RegExp(`    ${name}\\(\\) \\{([\\s\\S]*?)\\n    \\},`))[1] + '}')(newestRuns, (kind, id) => id === 'a')
  const run = (id, schedule, status = 'completed') => ({ id, created_at: id, kind: 'simulation', status, archive: { pinned: true }, request_snapshot: { schedule_id: schedule } })
  const ctx = { jobs: [run('1', 'a'), run('2', 'a', 'failed'), run('3', null), run('4', 'b')], schedules: [{ id: 'a', label: 'Same' }, { id: 'b', label: 'Same' }, { id: 'c', label: 'Empty' }], search: '', favoritesOnly: true, historyGroupKey: '' }
  ctx.scheduleForRun = run => scheduleForRun(run, ctx.schedules)
  ctx.visibleRuns = computed('visibleRuns').call(ctx)
  ctx.runGroups = computed('runGroups').call(ctx)
  assert.deepEqual(computed('cards').call(ctx).map(run => run.id), ['2'])
  assert.equal(computed('cards').call(ctx)[0].status, 'failed')
  ctx.historyGroupKey = 'a'
  assert.deepEqual(computed('cards').call(ctx).map(run => run.id), ['2', '1'])
  ctx.favoritesOnly = false; ctx.historyGroupKey = ''
  ctx.runGroups = computed('runGroups').call(ctx)
  assert.equal(ctx.runGroups.length, 3)
  assert.equal(computed('cards').call(ctx)[2].placeholder, true)
})
test('schedule identity survives renames and never merges unrelated same-title runs', async () => {
  const { scheduleForRun, latestScheduledRuns } = await import('../src/bt/utils/scheduledRuns.mjs')
  const schedules = [{ id: 'a', source_job_id: 'seed', label: 'Renamed' }]
  const run = (id, schedule, created) => ({ id, created_at: created, request_snapshot: { schedule_id: schedule, configuration: { label: 'Same' } } })
  const runs = [run('seed', null, '1'), run('old', 'a', '2'), run('new', 'a', '3'), run('single', null, '4'), run('other', 'b', '5')]
  assert.equal(scheduleForRun(runs[0], schedules).id, 'a')
  assert.equal(scheduleForRun(runs[3], schedules), null)
  assert.deepEqual(latestScheduledRuns(runs, schedules).map(r => r.id), ['new', 'single', 'other'])
  assert.deepEqual(latestScheduledRuns(runs, []).map(r => r.id), ['seed', 'new', 'single', 'other'])
})
test('daily bar dates omit time while minute dates retain it', () => {
  const match = dataSource.match(/formatBarDate\(value, timeframe\) \{([\s\S]*?)\n    \},/)
  const format = new Function('value', 'timeframe', match[1])
  assert.equal(format('2026-10-14T00:00:00', 'daily'), '2026-10-14')
  assert.equal(format('2026-10-14T09:31:00', 'minutes'), '2026-10-14 09:31:00')
  assert.equal(format(null, 'daily'), '—')
  assert.match(dataSource, /this\.barsTimeframe = params\.timeframe/)
  assert.match(dataSource, /this\.loadedTimeframe = params\.timeframe/)
})
