const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/WatchtowerCronMonitoring.vue'), 'utf8')
const match = source.match(/    async loadOverview\(\) \{([\s\S]*?)\n    \},/)
assert.ok(match)
const makeLoad = new Function('api', `return async function () {${match[1]}\n}`)
const profilesMatch = source.match(/    async loadProfiles\(\) \{([\s\S]*?)\n    \},\n    async loadOverview/)
assert.ok(profilesMatch)
const makeLoadProfiles = new Function('api', `return async function () {${profilesMatch[1]}\n}`)

test('switching profile selects a baseline belonging to the new profile', async () => {
  const ctx = { selectedProfile: 'challenger', selectedBaselineId: 35 }
  const load = makeLoad({ get: async () => ({ data: { baselines: [{ id: 84 }, { id: 33 }] } }) })
  await load.call(ctx)
  assert.equal(ctx.selectedBaselineId, 84)
  assert.equal(ctx.overview.baselines[0].id, ctx.selectedBaselineId)
})
test('refresh preserves a valid selection and clears it when no baseline exists', async () => {
  const ctx = { selectedProfile: 'challenger', selectedBaselineId: 33 }
  await makeLoad({ get: async () => ({ data: { baselines: [{ id: 84 }, { id: 33 }] } }) }).call(ctx)
  assert.equal(ctx.selectedBaselineId, 33)
  await makeLoad({ get: async () => ({ data: { baselines: [] } }) }).call(ctx)
  assert.equal(ctx.selectedBaselineId, null)
})

test('opening the monitor prefers the live profile over API ordering', async () => {
  const ctx = {
    profiles: [],
    selectedProfile: null,
    loading: false,
    loadError: '',
    loadOverview: async () => {},
  }
  await makeLoadProfiles({ get: async () => ({ data: [{ profile: 'development' }, { profile: 'LIVE' }, { profile: 'challenger' }] }) }).call(ctx)
  assert.equal(ctx.selectedProfile, 'LIVE')
})

test('opening the monitor falls back to the first profile when live is unavailable', async () => {
  const ctx = {
    profiles: [],
    selectedProfile: null,
    loading: false,
    loadError: '',
    loadOverview: async () => {},
  }
  await makeLoadProfiles({ get: async () => ({ data: [{ profile: 'development' }, { profile: 'challenger' }] }) }).call(ctx)
  assert.equal(ctx.selectedProfile, 'development')
})

test('cron sends its selected baseline without carrying it into another profile', async () => {
  let params
  const ctx = { selectedProfile: 'live', selectedBaselineId: 113, overview: { profile: 'live' } }
  const load = makeLoad({ get: async (url, options) => {
    params = options.params
    return { data: { profile: 'live', baselines: [{ id: 113 }] } }
  } })
  await load.call(ctx)
  assert.equal(params.baseline_id, 113)
  ctx.selectedProfile = 'development'
  await load.call(ctx)
  assert.equal(params.baseline_id, undefined)
})

test('switching baseline discards late results from the previous selection', async () => {
  const pending = []
  const ctx = { selectedProfile: 'live', selectedBaselineId: 1, overview: { profile: 'live' } }
  const load = makeLoad({ get: () => new Promise(resolve => pending.push(resolve)) })
  const first = load.call(ctx)
  ctx.selectedBaselineId = 2
  const second = load.call(ctx)
  const newest = { profile: 'live', baselines: [{ id: 1 }, { id: 2 }], reconciliation_statistics: { baseline_id: 2 } }
  pending[1]({ data: newest })
  await second
  pending[0]({ data: { profile: 'live', baselines: [{ id: 1 }] } })
  await first
  assert.equal(ctx.selectedBaselineId, 2)
  assert.equal(ctx.overview, newest)
})
