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
