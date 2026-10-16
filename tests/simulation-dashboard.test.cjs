const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/SimulationDashboard.vue'), 'utf8')
const dataSource = fs.readFileSync(path.join(__dirname, '../src/bt/pages/SimulationData.vue'), 'utf8')
test('pin icons use bundled SVGs without relying on an unloaded icon font', () => {
  assert.match(source, /import \{ matPushPin \} from "@quasar\/extras\/material-icons"/)
  assert.match(source, /import \{ outlinedPushPin \} from "@quasar\/extras\/material-icons-outlined"/)
  assert.match(source, /:icon="run\.archive\?\.pinned \? pinFilled : pinOutlined"/)
  assert.doesNotMatch(source, /'o_push_pin'/)
})
test('dashboard groups equal titles and opens newest-first history', () => {
  const computed = name => new Function(source.match(new RegExp(`    ${name}\\(\\) \\{([\\s\\S]*?)\\n    \\},`))[1])
  const visibleRuns = computed('visibleRuns')
  const runGroups = computed('runGroups')
  const cards = computed('cards')
  const run = (id, title, status = 'completed', hidden = false) => ({
    id, created_at: id, finished_at: id, kind: 'simulation', status, archive: { hidden },
    request_snapshot: { configuration: { strategy: 'Strategy', label: title } },
  })
  const context = {
    jobs: [run('1', 'challenger'), run('2', 'challenger'), run('3', 'challenger', 'failed'), run('4', 'B', 'completed', true), run('5', 'C')],
    search: '', showTrash: false, historyGroupKey: '',
    config: row => row.request_snapshot.configuration,
    runTitle: row => row.archive.label || row.request_snapshot.configuration.label,
    groupKey: row => (row.archive.label || row.request_snapshot.configuration.label).toLowerCase(),
  }
  context.jobs[0].archive.pinned = true
  context.visibleRuns = visibleRuns.call(context)
  context.runGroups = runGroups.call(context)
  assert.deepEqual(cards.call(context).map(row => row.id), ['2', '5'])
  assert.deepEqual(context.runGroups[0].runs.map(row => row.id), ['2', '1'])

  context.historyGroupKey = 'challenger'
  assert.deepEqual(cards.call(context).map(row => row.id), ['2', '1'])

  context.historyGroupKey = ''
  context.search = '5'
  context.visibleRuns = visibleRuns.call(context)
  context.runGroups = runGroups.call(context)
  assert.deepEqual(cards.call(context).map(row => row.id), ['5'])
})

test('dashboard exposes schedule state, pause and removal from each card', () => {
  assert.match(source, /label="Schedula" @click="openSchedule\(run\)"/)
  assert.match(source, /scheduleRow\.enabled \? "Attiva" : "In pausa"/)
  assert.match(source, /api\.patch\(`\/dyn\/simulations\/schedules\/\$\{encodeURIComponent\(this\.scheduleRow\.id\)\}`/)
  assert.match(source, /api\.delete\(`\/dyn\/simulations\/schedules\/\$\{encodeURIComponent\(this\.scheduleRow\.id\)\}`/)
  assert.match(source, /run-card-shell--stacked/)
  assert.match(source, /Chiudi storico/)
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
