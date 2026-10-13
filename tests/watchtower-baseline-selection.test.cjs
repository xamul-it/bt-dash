const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/WatchtowerCronMonitoring.vue'), 'utf8')
const match = source.match(/    async loadOverview\(\) \{([\s\S]*?)\n    \},/)
assert.ok(match)
const makeLoad = new Function('api', `return async function () {${match[1]}\n}`)

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
