const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/BacktestingStudio.vue'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const body = source.match(/    async saveRunNotes\(\) \{([\s\S]*?)\n    \},/)[1]
test('saving name and Markdown notes updates the open detail and list together', async () => {
  const saved = { id: 'run', archive: { label: 'Name', notes: '**Test**' } }
  const context = { notesForm: { id: 'run', label: 'Name', notes: '**Test**' }, selectedRun: { id: 'run' }, jobs: [{ id: 'run' }, { id: 'other' }], notesDialog: true }
  await new AsyncFunction('api', 'endpoint', body).call(context, { patch: async (url, payload) => {
    assert.equal(url, '/sim/jobs/run')
    assert.deepEqual(payload, { label: 'Name', notes: '**Test**' })
    return { data: saved }
  } }, '/sim')
  assert.deepEqual(context.selectedRun, saved)
  assert.deepEqual(context.jobs[0], saved)
  assert.equal(context.notesDialog, false)
  assert.equal(context.savingNotes, false)
})
test('save errors keep the note editor and entered text open', async () => {
  const context = { notesForm: { id: 'run', label: 'Name', notes: 'keep this' }, notesDialog: true, message: e => e.message }
  await new AsyncFunction('api', 'endpoint', body).call(context, { patch: async () => { throw Error('offline') } }, '')
  assert.equal(context.notesDialog, true)
  assert.equal(context.notesError, 'offline')
  assert.equal(context.notesForm.notes, 'keep this')
  assert.equal(context.savingNotes, false)
})
