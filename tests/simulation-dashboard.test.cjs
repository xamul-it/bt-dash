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
test('dashboard keeps independent runs, pinned first, with reversible trash', () => {
  const body = source.match(/cards\(\) \{([\s\S]*?)\n    \},/)[1]
  const cards = new Function(body)
  const run = (id, strategy, status = 'completed', hidden = false) => ({ id, created_at: id, kind: 'simulation', status, archive: { hidden }, request_snapshot: { configuration: { strategy } } })
  const context = { jobs: [run('1', 'A'), run('2', 'A'), run('3', 'A', 'failed'), run('4', 'B', 'completed', true), run('5', 'C')], search: '', showTrash: false, config: r => r.request_snapshot.configuration }
  context.jobs[0].archive.pinned = true
  assert.deepEqual(cards.call(context).map(r => r.id), ['1', '5', '2'])
  context.search = 'a'
  assert.deepEqual(cards.call(context).map(r => r.id), ['1', '2'])
  context.search = ''; context.showTrash = true
  assert.deepEqual(cards.call(context).map(r => r.id), ['4'])
  context.jobs[3].archive.hidden = false
  context.showTrash = false
  assert.deepEqual(cards.call(context).map(r => r.id), ['1','5','4','2'])
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
